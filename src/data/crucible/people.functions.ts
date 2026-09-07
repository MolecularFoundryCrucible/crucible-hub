import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import {
  lookupWorkspaceServiceAccount,
  readWorkspacePerson,
} from "./people.server"
import { queryCancellationMiddleware } from "./query-cancellation"

export const personDetailInputSchema = z.object({
  personId: z.string().trim().min(1).max(255),
  scenario: fixtureScenarioSchema.optional(),
})

export const serviceAccountLookupInputSchema = z
  .object({
    reference: z.string().trim().min(3).max(255),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const getWorkspacePerson = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(personDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspacePerson(data.personId, data.scenario, context.requestSignal)
    )
  })

export const getWorkspaceServiceAccount = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(serviceAccountLookupInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      lookupWorkspaceServiceAccount(
        data.reference,
        data.scenario,
        context.requestSignal
      )
    )
  })
