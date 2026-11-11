import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import {
  readDatasetPostprocessingRuns,
  readWorkspacePipelines,
  startDatasetPostprocessing,
} from "./postprocessing.server"
import { queryCancellationMiddleware } from "./query-cancellation"

const datasetMfidSchema = z.string().trim().min(1).max(255)

export const getWorkspacePipelines = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ scenario: fixtureScenarioSchema.optional() }).strict())
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspacePipelines(data.scenario, context.requestSignal)
    )
  })

export const getDatasetPostprocessingRuns = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        datasetMfid: datasetMfidSchema,
        limit: z.number().int().min(1).max(100),
        scenario: fixtureScenarioSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readDatasetPostprocessingRuns(
        data.datasetMfid,
        data.limit,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const startDatasetPostprocessingFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        datasetMfid: datasetMfidSchema,
        idempotencyKey: z.string().min(1).max(128),
        parameters: z.record(
          z.string(),
          z.union([z.boolean(), z.number(), z.string(), z.null()])
        ),
        pipeline: z.string().trim().min(1).max(255),
        scenario: fixtureScenarioSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      startDatasetPostprocessing(data, data.scenario, context.requestSignal)
    )
  })
