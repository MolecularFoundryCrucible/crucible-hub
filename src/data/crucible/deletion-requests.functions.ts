import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import {
  readWorkspaceDeletionAudit,
  readWorkspaceDeletionRequests,
  reviewWorkspaceDeletionRequest,
} from "./deletion-requests.server"
import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"

const deletionRequestScopeSchema = z.enum([
  "accessible",
  "reviewable",
  "submitted",
])
const deletionRequestStatusSchema = z.enum(["approved", "pending", "rejected"])
const deletionRequestDirectionSchema = z.enum(["asc", "desc"])
const deletionRequestSortSchema = z.enum([
  "project_id",
  "request_time",
  "requester_name",
  "resource_name",
  "status",
])
const deletionReviewDecisionSchema = z.enum(["approved", "rejected"])

export const deletionRequestListInputSchema = z
  .object({
    cursor: z.string().min(1).max(4_096).optional(),
    direction: deletionRequestDirectionSchema,
    limit: z.number().int().min(1).max(1_000),
    projectMfid: z.string().trim().min(1).max(255).optional(),
    scenario: fixtureScenarioSchema.optional(),
    scope: deletionRequestScopeSchema,
    sort: deletionRequestSortSchema,
    status: deletionRequestStatusSchema.optional(),
  })
  .strict()

export const deletionRequestReviewInputSchema = z
  .object({
    decision: deletionReviewDecisionSchema,
    requestId: z.number().int().positive(),
    reviewerNotes: z.string().trim().max(2_000).optional(),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const deletionAuditListInputSchema = z
  .object({
    limit: z.number().int().min(1).max(1_000),
    offset: z.number().int().min(0),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const getWorkspaceDeletionAudit = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(deletionAuditListInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceDeletionAudit(data, context.requestSignal)
    )
  })

export const getWorkspaceDeletionRequests = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(deletionRequestListInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceDeletionRequests(data, context.requestSignal)
    )
  })

export const reviewWorkspaceDeletionRequestById = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(deletionRequestReviewInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(
      context.correlationId,
      () =>
        reviewWorkspaceDeletionRequest(
          data.requestId,
          data.decision,
          data.reviewerNotes,
          data.scenario,
          context.requestSignal
        ),
      { operation: "review-deletion-request" }
    )
  })
