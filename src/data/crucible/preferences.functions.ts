import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { accountPreferencesPatchSchema } from "./preferences"
import {
  patchAccountPreferences,
  readAccountPreferences,
} from "./preferences.server"
import { queryCancellationMiddleware } from "./query-cancellation"

export const getAccountPreferences = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ scenario: fixtureScenarioSchema.optional() }))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readAccountPreferences(data.scenario, context.requestSignal)
    )
  })

export const updateAccountPreferences = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        etag: z.string().min(1).max(64),
        patch: accountPreferencesPatchSchema,
        scenario: fixtureScenarioSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      patchAccountPreferences(
        data.patch,
        data.etag,
        data.scenario,
        context.requestSignal
      )
    )
  })
