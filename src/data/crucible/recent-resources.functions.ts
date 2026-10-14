import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"
import {
  clearRecentResources,
  readRecentResources,
  recordRecentResource,
} from "./recent-resources.server"

export const getRecentResources = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z.object({
      limit: z.number().int().min(1).max(50),
      scenario: fixtureScenarioSchema.optional(),
    })
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readRecentResources(data.limit, data.scenario, context.requestSignal)
    )
  })

export const recordRecentResourceView = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        resourceMfid: z.string().min(1).max(64),
        scenario: fixtureScenarioSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      recordRecentResource(
        data.resourceMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const clearRecentResourceHistory = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ scenario: fixtureScenarioSchema.optional() }))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      clearRecentResources(data.scenario, context.requestSignal)
    )
  })
