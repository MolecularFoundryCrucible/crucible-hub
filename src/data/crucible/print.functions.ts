import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { labelNameMaxLength, printerIdSchema } from "./print"
import { queryCancellationMiddleware } from "./query-cancellation"
import { printWorkspaceLabel, readWorkspacePrinters } from "./print.server"

export const getWorkspacePrinters = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ scenario: fixtureScenarioSchema.optional() }))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspacePrinters(data.scenario, context.requestSignal)
    )
  })

export const printWorkspaceResourceLabel = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        mfid: z.string().trim().min(1).max(64),
        name: z.string().trim().min(1).max(labelNameMaxLength),
        printerId: printerIdSchema,
        scenario: fixtureScenarioSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      printWorkspaceLabel(
        { mfid: data.mfid, name: data.name, printerId: data.printerId },
        data.scenario,
        context.requestSignal
      )
    )
  })
