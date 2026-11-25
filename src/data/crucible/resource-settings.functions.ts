import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"
import {
  readWorkspaceResourceSettings,
  updateWorkspaceDefaultStore,
} from "./resource-settings.server"

const settingsTargetSchema = z.object({
  kind: z.enum(["project", "instrument"]),
  mfid: z.string().trim().min(1).max(255),
  scenario: fixtureScenarioSchema.optional(),
})

export const getWorkspaceResourceSettings = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(settingsTargetSchema.strict())
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceResourceSettings(
        data.kind,
        data.mfid,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const updateDefaultStoreFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    settingsTargetSchema
      .extend({
        defaultStoreId: z
          .string()
          .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
          .max(63)
          .nullable(),
        etag: z.string().min(1).max(255),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      updateWorkspaceDefaultStore(
        data.kind,
        data.mfid,
        data.defaultStoreId,
        data.etag,
        data.scenario,
        context.requestSignal
      )
    )
  })
