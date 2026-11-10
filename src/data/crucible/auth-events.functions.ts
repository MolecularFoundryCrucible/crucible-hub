import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { readWorkspaceAuthEvents } from "./auth-events.server"
import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"

export const getWorkspaceAuthEvents = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        cursor: z.string().min(1).max(4096).optional(),
        limit: z.number().int().min(1).max(200),
        scenario: fixtureScenarioSchema.optional(),
        userId: z.string().trim().min(1).max(255).optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceAuthEvents(
        data.userId ? { kind: "user", userId: data.userId } : { kind: "self" },
        { cursor: data.cursor, limit: data.limit },
        data.scenario,
        context.requestSignal
      )
    )
  })
