import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import {
  createJoinRequest,
  readJoinRequests,
  reviewJoinRequest,
  withdrawJoinRequest,
} from "./join-requests.server"
import { privilegeModeSchema } from "./privilege-mode"
import { queryCancellationMiddleware } from "./query-cancellation"

const mfidSchema = z.string().trim().min(1).max(255)
const requestIdSchema = z.number().int().positive()
const noteSchema = z.string().trim().max(2000).nullable()

export const getJoinRequests = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        cursor: z.string().min(1).max(4096).optional(),
        limit: z.number().int().min(1).max(200),
        privilegeMode: privilegeModeSchema,
        projectMfid: mfidSchema.optional(),
        scenario: fixtureScenarioSchema.optional(),
        scope: z.enum(["reviewable", "submitted"]),
        status: z
          .enum(["pending", "approved", "rejected", "withdrawn"])
          .optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readJoinRequests(
        {
          cursor: data.cursor,
          limit: data.limit,
          projectMfid: data.projectMfid,
          scope: data.scope,
          status: data.status,
        },
        data.privilegeMode,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const createJoinRequestFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        projectRef: mfidSchema,
        reason: noteSchema,
        scenario: fixtureScenarioSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      createJoinRequest(
        data.projectRef,
        data.reason || null,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const reviewJoinRequestFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        privilegeMode: privilegeModeSchema,
        requestId: requestIdSchema,
        reviewerNotes: noteSchema,
        role: z.enum(["viewer", "contributor", "editor", "admin"]).optional(),
        scenario: fixtureScenarioSchema.optional(),
        status: z.enum(["approved", "rejected"]),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      reviewJoinRequest(
        data.requestId,
        {
          reviewerNotes: data.reviewerNotes || null,
          role: data.role,
          status: data.status,
        },
        data.privilegeMode,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const withdrawJoinRequestFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        requestId: requestIdSchema,
        scenario: fixtureScenarioSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      withdrawJoinRequest(data.requestId, data.scenario, context.requestSignal)
    )
  })
