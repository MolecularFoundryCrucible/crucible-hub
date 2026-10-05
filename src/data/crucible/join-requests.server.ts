import "@tanstack/react-start/server-only"

import { CrucibleResponseError } from "@/server/crucible/request-error.server"
import { createCrucibleClient } from "@/server/crucible/client.server"
import { crucibleRequestSignal } from "@/server/crucible/request-signal.server"

import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import type {
  WorkspaceJoinRequest,
  WorkspaceJoinRequestPage,
  WorkspaceJoinRequestReview,
} from "./workspace-source"

type JoinRequestFilterInput = {
  group_name?: string
  limit: number
  offset: number
  requester_id?: string
  scenario?: FixtureScenario
  status?: string
}

const fixtureJoinRequests: WorkspaceJoinRequest[] = [
  {
    group_name: "spectroscopy-core",
    id: 1,
    reason:
      "Need access to XAS beamline data for cross-facility collaboration.",
    request_time: "2026-10-01T10:00:00Z",
    requester_id: "0000-0002-8792-9669",
    review_time: null,
    reviewer_id: null,
    reviewer_notes: null,
    status: "pending",
  },
  {
    group_name: "catalysis-lab",
    id: 2,
    reason: "Joint catalysis synthesis experiment and data analysis.",
    request_time: "2026-09-20T14:30:00Z",
    requester_id: "0000-0001-6402-3752",
    review_time: "2026-09-21T09:15:00Z",
    reviewer_id: "0000-0001-6402-3752",
    reviewer_notes: "Approved for Q4 synthesis campaign.",
    status: "approved",
  },
  {
    group_name: "automation-ops",
    id: 3,
    reason: "Testing robotic transfer scripts on CoffeeArm.",
    request_time: "2026-09-15T11:00:00Z",
    requester_id: "0000-0002-1234-5678",
    review_time: "2026-09-16T08:00:00Z",
    reviewer_id: "0000-0001-6402-3752",
    reviewer_notes: "Please request authorization via lab supervisor first.",
    status: "rejected",
  },
]

export async function readWorkspaceJoinRequests(
  input: JoinRequestFilterInput,
  requestSignal?: AbortSignal
): Promise<WorkspaceJoinRequestPage> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    let items = [...fixtureJoinRequests]
    if (input.status) {
      items = items.filter(
        (r) => r.status.toLowerCase() === input.status?.toLowerCase()
      )
    }
    if (input.group_name) {
      items = items.filter((r) => r.group_name === input.group_name)
    }
    if (input.requester_id) {
      items = items.filter((r) => r.requester_id === input.requester_id)
    }
    return {
      items: items.slice(input.offset, input.offset + input.limit),
      limit: input.limit,
      offset: input.offset,
      total: items.length,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.GET("/join_requests", {
    params: {
      query: {
        group_name: input.group_name,
        limit: input.limit,
        offset: input.offset,
        requester_id: input.requester_id,
        status: input.status,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return {
    items: result.data.items,
    limit: result.data.limit,
    offset: result.data.offset ?? input.offset,
    total: result.data.total ?? null,
  }
}

export async function readWorkspaceJoinRequest(
  requestId: number,
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceJoinRequest | null> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const item = fixtureJoinRequests.find((r) => r.id === requestId)
    return item ?? null
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.GET("/join_requests/{request_id}", {
    params: { path: { request_id: requestId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (result.response.status === 404) return null
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}

export async function reviewWorkspaceJoinRequest(
  requestId: number,
  review: WorkspaceJoinRequestReview,
  _scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspaceJoinRequest> {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") {
    const item = fixtureJoinRequests.find((r) => r.id === requestId)
    if (!item) throw new Error(`Join request #${requestId} not found`)
    return {
      ...item,
      review_time: new Date().toISOString(),
      reviewer_id: "0000-0001-6402-3752",
      reviewer_notes: review.reviewer_notes ?? null,
      status: review.status,
    }
  }

  const client = createCrucibleClient(configuration, {
    privilegeMode: "elevated",
  })
  const result = await client.PATCH("/join_requests/{request_id}", {
    body: review,
    params: { path: { request_id: requestId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) throw new CrucibleResponseError(result.response.status)
  return result.data
}
