import "@tanstack/react-start/server-only"

import { z } from "zod"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import { fixtureCursorPage } from "./pagination"
import { workspacePersonSchema } from "./people.schema"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceDeletionAudit,
  WorkspaceDeletionAuditPage,
  WorkspaceDeletionRequest,
  WorkspaceDeletionRequestPage,
  WorkspaceDeletionRequestSort,
} from "./workspace-source"

export type WorkspaceDeletionAuditFilters = {
  limit: number
  offset: number
}

export type WorkspaceDeletionRequestScope =
  "accessible" | "reviewable" | "submitted"
export type WorkspaceDeletionRequestStatus = "approved" | "pending" | "rejected"
export type WorkspaceDeletionReviewDecision = "approved" | "rejected"
export type WorkspaceDeletionRequestDirection = "asc" | "desc"

export type WorkspaceDeletionRequestFilters = {
  cursor?: string
  direction: WorkspaceDeletionRequestDirection
  limit: number
  projectMfid?: string
  scope: WorkspaceDeletionRequestScope
  sort: WorkspaceDeletionRequestSort
  status?: WorkspaceDeletionRequestStatus
}

const deletionRequestSchema = z
  .object({
    capabilities: z.object({ can_review: z.boolean() }).strict(),
    id: z.number().int().positive(),
    project_id: z.string().nullable().optional(),
    project_mfid: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    request_time: z.string().nullable().optional(),
    requester: workspacePersonSchema.nullable(),
    requester_id: z.string().min(1),
    resource_id: z.string().min(1),
    resource_name: z.string().nullable().optional(),
    resource_type: z.string().nullable().optional(),
    review_time: z.string().nullable().optional(),
    reviewer: workspacePersonSchema.nullable(),
    reviewer_id: z.string().nullable().optional(),
    reviewer_notes: z.string().nullable().optional(),
    status: z.enum(["pending", "approved", "rejected"]),
  })
  .passthrough()

const deletionRequestPageSchema = z
  .object({
    items: z.array(deletionRequestSchema).max(1_000),
    limit: z.number().int().positive(),
    next_cursor: z.string().nullable().optional(),
    offset: z.number().int().nonnegative().nullable().optional(),
    total: z.number().int().nonnegative().nullable().optional(),
  })
  .passthrough()

const deletionAuditSchema = z
  .object({
    deleted_at: z.string(),
    id: z.number().int().positive(),
    project_id: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    request_time: z.string().nullable().optional(),
    requester_id: z.string().min(1),
    resource_id: z.string().min(1),
    resource_name: z.string().nullable().optional(),
    resource_type: z.string().nullable().optional(),
    review_time: z.string().nullable().optional(),
    reviewer_id: z.string().min(1),
    reviewer_notes: z.string().nullable().optional(),
  })
  .passthrough()

const deletionAuditPageSchema = z
  .object({
    items: z.array(deletionAuditSchema).max(1_000),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative().nullable().optional(),
    total: z.number().int().nonnegative().nullable().optional(),
  })
  .passthrough()

const fixtureDeletionRequestState = new Map<string, WorkspaceDeletionRequest>()
const deletionRequestCollator = new Intl.Collator("en", { sensitivity: "base" })

function workspaceDeletionRequest(value: unknown): WorkspaceDeletionRequest {
  const result = deletionRequestSchema.safeParse(value)
  if (!result.success) {
    throw new Error("The deletion request response is invalid.")
  }
  return {
    capabilities: result.data.capabilities,
    id: result.data.id,
    project_id: result.data.project_id ?? null,
    project_mfid: result.data.project_mfid ?? null,
    reason: result.data.reason ?? null,
    request_time: result.data.request_time ?? null,
    requester: result.data.requester,
    requester_id: result.data.requester_id,
    resource_id: result.data.resource_id,
    resource_name: result.data.resource_name ?? null,
    resource_type: result.data.resource_type ?? null,
    review_time: result.data.review_time ?? null,
    reviewer: result.data.reviewer,
    reviewer_id: result.data.reviewer_id ?? null,
    reviewer_notes: result.data.reviewer_notes ?? null,
    status: result.data.status,
  }
}

function fixtureDeletionRequests(
  scenario?: FixtureScenario
): WorkspaceDeletionRequest[] {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const resource = source.workspace.datasets[0]
  const submittedResource = source.workspace.samples[1]
  const requester = source.workspace.people[1] ?? source.workspace.account
  const request = {
    capabilities: { can_review: true },
    id: 1,
    project_id: resource.project_id ?? null,
    project_mfid: resource.project?.unique_id ?? null,
    reason: "The acquisition was superseded by a corrected dataset.",
    request_time: "2026-08-31T18:10:00Z",
    requester,
    requester_id: requester.unique_id,
    resource_id: resource.unique_id,
    resource_name: resource.dataset_name ?? null,
    resource_type: "dataset",
    review_time: null,
    reviewer: null,
    reviewer_id: null,
    reviewer_notes: null,
    status: "pending",
  } satisfies WorkspaceDeletionRequest
  const requests = [
    fixtureDeletionRequestState.get(
      `${scenario ?? "populated"}:${request.id}`
    ) ?? request,
  ]
  requests.push({
    capabilities: { can_review: false },
    id: 2,
    project_id: submittedResource.project_id ?? null,
    project_mfid: submittedResource.project?.unique_id ?? null,
    reason: "The sample record was created in error.",
    request_time: "2026-08-25T15:40:00Z",
    requester: source.workspace.account,
    requester_id: source.workspace.account.unique_id,
    resource_id: submittedResource.unique_id,
    resource_name: submittedResource.sample_name,
    resource_type: "sample",
    review_time: "2026-08-26T17:20:00Z",
    reviewer: requester,
    reviewer_id: requester.unique_id,
    reviewer_notes: "The record remains relevant to an existing dataset.",
    status: "rejected",
  })
  return requests
}

export async function readWorkspaceDeletionRequests(
  input: WorkspaceDeletionRequestFilters & { scenario?: FixtureScenario },
  requestSignal?: AbortSignal
): Promise<WorkspaceDeletionRequestPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(input.scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    const requests = fixtureDeletionRequests(input.scenario)
      .filter(
        (request) =>
          (input.scope !== "reviewable" || request.capabilities.can_review) &&
          (input.scope !== "submitted" ||
            request.requester_id === source.workspace.account.unique_id) &&
          (!input.status || request.status === input.status) &&
          (!input.projectMfid || request.project_mfid === input.projectMfid)
      )
      .sort((left, right) => compareDeletionRequests(left, right, input))
    const page = fixtureCursorPage(requests, input)
    return {
      ...page,
    }
  }

  const result = await createCrucibleClient(configuration).GET(
    "/deletion_requests",
    {
      params: {
        query: {
          cursor: input.cursor,
          direction: input.direction,
          limit: input.limit,
          project_mfid: input.projectMfid,
          scope: input.scope,
          sort: input.sort,
          status: input.status,
        },
      },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  const page = deletionRequestPageSchema.safeParse(result.data)
  if (!page.success) throw new Error("The deletion request list is invalid.")
  return {
    items: page.data.items.map(workspaceDeletionRequest),
    limit: page.data.limit,
    nextCursor: page.data.next_cursor ?? null,
    total: page.data.total ?? null,
  }
}

export async function readWorkspaceDeletionAudit(
  input: WorkspaceDeletionAuditFilters & { scenario?: FixtureScenario },
  requestSignal?: AbortSignal
): Promise<WorkspaceDeletionAuditPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(input.scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    const resource = source.workspace.samples[0]
    const reviewer = source.workspace.account
    const requester = source.workspace.people[1] ?? reviewer
    const items: WorkspaceDeletionAudit[] = [
      {
        deleted_at: "2026-08-21T16:31:00Z",
        id: 1,
        project_id: resource.project_id ?? null,
        reason: "The duplicate sample record is no longer needed.",
        request_time: "2026-08-20T14:15:00Z",
        requester_id: requester.unique_id,
        resource_id: resource.unique_id,
        resource_name: resource.sample_name,
        resource_type: "sample",
        review_time: "2026-08-21T16:30:00Z",
        reviewer_id: reviewer.unique_id,
        reviewer_notes: "Confirmed as a duplicate record.",
      },
    ]
    return {
      items: items.slice(input.offset, input.offset + input.limit),
      limit: input.limit,
      offset: input.offset,
      total: items.length,
    }
  }

  const result = await createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  }).GET("/deletion_audit", {
    params: { query: { limit: input.limit, offset: input.offset } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  const page = deletionAuditPageSchema.safeParse(result.data)
  if (!page.success) throw new Error("The deletion audit list is invalid.")
  return {
    items: page.data.items,
    limit: page.data.limit,
    offset: page.data.offset ?? input.offset,
    total: page.data.total ?? null,
  }
}

function compareDeletionRequests(
  left: WorkspaceDeletionRequest,
  right: WorkspaceDeletionRequest,
  input: Pick<WorkspaceDeletionRequestFilters, "direction" | "sort">
) {
  const fields = deletionRequestSortValues(input.sort, left, right)
  for (const [leftValue, rightValue] of fields) {
    const order = compareNullableDeletionRequestValue(
      leftValue,
      rightValue,
      input.direction
    )
    if (order !== 0) return order
  }
  return input.direction === "asc" ? left.id - right.id : right.id - left.id
}

function deletionRequestSortValues(
  sort: WorkspaceDeletionRequestSort,
  left: WorkspaceDeletionRequest,
  right: WorkspaceDeletionRequest
): readonly (readonly [number | string | null, number | string | null])[] {
  if (sort === "requester_name") {
    return [
      [personSortValue(left, "last_name"), personSortValue(right, "last_name")],
      [
        personSortValue(left, "first_name"),
        personSortValue(right, "first_name"),
      ],
      [personSortValue(left, "username"), personSortValue(right, "username")],
      [
        left.requester?.unique_id ?? left.requester_id,
        right.requester?.unique_id ?? right.requester_id,
      ],
    ]
  }
  if (sort === "status") {
    const order = { approved: 1, pending: 0, rejected: 2 } as const
    return [[order[left.status], order[right.status]]]
  }
  if (sort === "resource_name")
    return [
      [
        normalizedSortValue(left.resource_name),
        normalizedSortValue(right.resource_name),
      ],
    ]
  if (sort === "project_id")
    return [
      [
        normalizedSortValue(left.project_id),
        normalizedSortValue(right.project_id),
      ],
    ]
  return [
    [
      normalizedSortValue(left.request_time),
      normalizedSortValue(right.request_time),
    ],
  ]
}

function personSortValue(
  request: WorkspaceDeletionRequest,
  field: "first_name" | "last_name" | "username"
) {
  return normalizedSortValue(request.requester?.[field])
}

function normalizedSortValue(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || null
}

function compareNullableDeletionRequestValue(
  left: number | string | null,
  right: number | string | null,
  direction: WorkspaceDeletionRequestDirection
) {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  const order =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : deletionRequestCollator.compare(String(left), String(right))
  return direction === "asc" ? order : -order
}

export async function reviewWorkspaceDeletionRequest(
  requestId: number,
  decision: WorkspaceDeletionReviewDecision,
  reviewerNotes?: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceDeletionRequest> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable")
    throw new Error(configuration.reason)
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    const request = fixtureDeletionRequests(scenario).find(
      (candidate) => candidate.id === requestId
    )
    if (!request) throw new CrucibleResponseError(404)
    const reviewed = {
      ...request,
      capabilities: { can_review: false },
      reviewer: source.workspace.account,
      reviewer_id: source.workspace.account.unique_id,
      reviewer_notes: reviewerNotes ?? null,
      review_time: "2026-09-01T16:00:00Z",
      status: decision,
    }
    fixtureDeletionRequestState.set(
      `${scenario ?? "populated"}:${request.id}`,
      reviewed
    )
    return reviewed
  }

  const result = await createCrucibleClient(configuration).PATCH(
    "/deletion_requests/{request_id}",
    {
      params: {
        path: { request_id: requestId },
        query: {
          reviewer_notes: reviewerNotes,
          status: decision,
        },
      },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return workspaceDeletionRequest(result.data)
}
