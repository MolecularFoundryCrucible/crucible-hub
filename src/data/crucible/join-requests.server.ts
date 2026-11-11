import "@tanstack/react-start/server-only"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import type { WorkspacePrivilegeMode } from "./privilege-mode"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type {
  WorkspaceJoinRequest,
  WorkspaceJoinRequestPage,
  WorkspaceJoinRequestRole,
  WorkspaceJoinRequestStatus,
} from "./workspace-source"

export type JoinRequestQuery = {
  cursor?: string
  limit: number
  projectMfid?: string
  scope: "reviewable" | "submitted"
  status?: WorkspaceJoinRequestStatus
}

function fixtureJoinRequests(
  scenario?: FixtureScenario
): WorkspaceJoinRequest[] {
  const source = readWorkspaceFixture(scenario)
  if (source.status === "unavailable") throw new Error(source.reason)
  const { account, projects, referenceTime } = source.workspace
  const project = projects.at(0)
  if (!project) return []
  const reference = Date.parse(referenceTime)
  const reviewable: WorkspaceJoinRequest = {
    capabilities: { can_review: true, can_withdraw: false },
    granted_role: null,
    id: 41,
    project: {
      project_id: project.project_id,
      title: project.title ?? null,
      unique_id: project.unique_id,
    },
    project_mfid: project.unique_id,
    reason: "I run the in-situ cell for this beamtime.",
    request_time: new Date(reference - 3 * 60 * 60 * 1000).toISOString(),
    requester: {
      first_name: "Riley",
      is_service_account: false,
      last_name: "Park",
      unique_id: "0000-0000-0000-0042",
      username: "riley.park",
    },
    requester_id: "0000-0000-0000-0042",
    review_time: null,
    reviewer: null,
    reviewer_id: null,
    reviewer_notes: null,
    status: "pending",
  }
  const submitted: WorkspaceJoinRequest = {
    ...reviewable,
    capabilities: { can_review: false, can_withdraw: false },
    granted_role: "contributor",
    id: 12,
    reason: null,
    request_time: new Date(reference - 9 * 24 * 60 * 60 * 1000).toISOString(),
    requester: {
      first_name: account.first_name,
      is_service_account: false,
      last_name: account.last_name,
      unique_id: account.unique_id,
      username: account.username ?? null,
    },
    requester_id: account.unique_id,
    review_time: new Date(reference - 8 * 24 * 60 * 60 * 1000).toISOString(),
    status: "approved",
  }
  return [reviewable, submitted]
}

export async function readJoinRequests(
  query: JoinRequestQuery,
  privilegeMode: WorkspacePrivilegeMode,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceJoinRequestPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const items = fixtureJoinRequests(scenario).filter(
      (request) =>
        (query.scope === "reviewable"
          ? request.capabilities.can_review
          : !request.capabilities.can_review) &&
        (!query.status || request.status === query.status) &&
        (!query.projectMfid || request.project_mfid === query.projectMfid)
    )
    return { items, nextCursor: null, total: items.length }
  }
  const result = await createCrucibleClient(configuration, {
    privilegeMode,
  }).GET("/join_requests", {
    params: {
      query: {
        cursor: query.cursor,
        direction: "desc",
        limit: query.limit,
        project_mfid: query.projectMfid ? [query.projectMfid] : undefined,
        scope: query.scope,
        sort: "request_time",
        status: query.status ? [query.status] : undefined,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return {
    items: result.data.items,
    nextCursor: result.data.next_cursor ?? null,
    total: result.data.total ?? null,
  }
}

export async function createJoinRequest(
  projectRef: string,
  reason: string | null,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceJoinRequest> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const [request] = fixtureJoinRequests(scenario)
    return {
      ...request,
      capabilities: { can_review: false, can_withdraw: true },
      id: 99,
      reason,
      request_time: new Date().toISOString(),
    }
  }
  const result = await createCrucibleClient(configuration).POST(
    "/projects/{project_ref}/join_requests",
    {
      body: { reason },
      params: { path: { project_ref: projectRef } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return result.data
}

export async function reviewJoinRequest(
  requestId: number,
  review: {
    reviewerNotes: string | null
    role?: WorkspaceJoinRequestRole
    status: "approved" | "rejected"
  },
  privilegeMode: WorkspacePrivilegeMode,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceJoinRequest> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const request = fixtureJoinRequests(scenario).find(
      (candidate) => candidate.id === requestId
    )
    if (!request) throw new CrucibleResponseError(404)
    return {
      ...request,
      capabilities: { can_review: false, can_withdraw: false },
      granted_role:
        review.status === "approved" ? (review.role ?? "contributor") : null,
      review_time: new Date().toISOString(),
      reviewer_notes: review.reviewerNotes,
      status: review.status,
    }
  }
  const result = await createCrucibleClient(configuration, {
    privilegeMode,
  }).PATCH("/join_requests/{request_id}", {
    body: {
      reviewer_notes: review.reviewerNotes,
      role: review.status === "approved" ? (review.role ?? null) : null,
      status: review.status,
    },
    params: { path: { request_id: requestId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return result.data
}

export async function withdrawJoinRequest(
  requestId: number,
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<void> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") return
  const result = await createCrucibleClient(configuration).POST(
    "/join_requests/{request_id}/withdraw",
    {
      params: { path: { request_id: requestId } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}
