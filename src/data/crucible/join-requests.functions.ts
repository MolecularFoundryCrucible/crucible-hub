import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import {
  readWorkspaceJoinRequest,
  readWorkspaceJoinRequests,
  reviewWorkspaceJoinRequest,
} from "./join-requests.server"
import { queryCancellationMiddleware } from "./query-cancellation"

export const joinRequestListInputSchema = z
  .object({
    group_name: z.string().trim().min(1).max(255).optional(),
    limit: z.number().int().min(1).max(1000),
    offset: z.number().int().min(0),
    requester_id: z.string().trim().min(1).max(255).optional(),
    scenario: fixtureScenarioSchema.optional(),
    status: z.string().trim().min(1).max(50).optional(),
  })
  .strict()

export const joinRequestDetailInputSchema = z
  .object({
    requestId: z.number().int().positive(),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const joinRequestReviewInputSchema = z
  .object({
    requestId: z.number().int().positive(),
    review: z
      .object({
        reviewer_notes: z.string().trim().max(1000).nullable().optional(),
        status: z.enum(["approved", "rejected"]),
      })
      .strict(),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const getWorkspaceJoinRequests = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(joinRequestListInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceJoinRequests(data, context.requestSignal)
    )
  })

export const getWorkspaceJoinRequest = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(joinRequestDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceJoinRequest(
        data.requestId,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const reviewWorkspaceJoinRequestFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(joinRequestReviewInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      reviewWorkspaceJoinRequest(
        data.requestId,
        data.review,
        data.scenario,
        context.requestSignal
      )
    )
  })
