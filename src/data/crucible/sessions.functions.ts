import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"
import {
  endOtherWorkspaceSessions,
  endWorkspaceSession,
  readWorkspaceSessions,
} from "./sessions.server"

const userIdSchema = z.string().trim().min(1).max(255)

function owner(userId: string | undefined) {
  return userId ? { kind: "user" as const, userId } : { kind: "self" as const }
}

export const getWorkspaceSessions = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        cursor: z.string().min(1).max(4096).optional(),
        limit: z.number().int().min(1).max(200),
        scenario: fixtureScenarioSchema.optional(),
        userId: userIdSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceSessions(
        owner(data.userId),
        { cursor: data.cursor, limit: data.limit },
        data.scenario,
        context.requestSignal
      )
    )
  })

export const endWorkspaceSessionFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        sessionId: z.string().min(1).max(255),
        userId: userIdSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      endWorkspaceSession(
        owner(data.userId),
        data.sessionId,
        context.requestSignal
      )
    )
  })

export const endOtherWorkspaceSessionsFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ userId: userIdSchema.optional() }).strict())
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      endOtherWorkspaceSessions(owner(data.userId), context.requestSignal)
    )
  })
