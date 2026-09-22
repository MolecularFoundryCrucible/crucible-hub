import "@tanstack/react-start/server-only"

import { z } from "zod"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import { fixtureCursorPage } from "./pagination"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceDeletionRequest,
  WorkspaceDeletionRequestPage,
} from "./workspace-source"

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
  sort: "request_time"
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
    requester_id: z.string().min(1),
    resource_id: z.string().min(1),
    resource_name: z.string().nullable().optional(),
    resource_type: z.string().nullable().optional(),
    review_time: z.string().nullable().optional(),
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

const fixtureDeletionRequestState = new Map<string, WorkspaceDeletionRequest>()

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
    requester_id: result.data.requester_id,
    resource_id: result.data.resource_id,
    resource_name: result.data.resource_name ?? null,
    resource_type: result.data.resource_type ?? null,
    review_time: result.data.review_time ?? null,
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
    requester_id: requester.unique_id,
    resource_id: resource.unique_id,
    resource_name: resource.dataset_name ?? null,
    resource_type: "dataset",
    review_time: null,
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
    requester_id: source.workspace.account.unique_id,
    resource_id: submittedResource.unique_id,
    resource_name: submittedResource.sample_name,
    resource_type: "sample",
    review_time: "2026-08-26T17:20:00Z",
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
      .sort((left, right) => {
        const timeOrder = (left.request_time ?? "").localeCompare(
          right.request_time ?? ""
        )
        const order = timeOrder || left.id - right.id
        return input.direction === "asc" ? order : -order
      })
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
