import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import {
  removeDatasetFile,
  renameDatasetFile,
} from "./dataset-file-actions.server"
import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"

const fileMfidSchema = z.string().trim().min(1).max(255)

export const renameDatasetFileFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        fileMfid: fileMfidSchema,
        filename: z.string().trim().min(1).max(1024),
        scenario: fixtureScenarioSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      renameDatasetFile(
        data.fileMfid,
        data.filename,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const removeDatasetFileFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        fileMfid: fileMfidSchema,
        scenario: fixtureScenarioSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      removeDatasetFile(data.fileMfid, data.scenario, context.requestSignal)
    )
  })
