import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { readWorkspacePerson } from "./people.server"
import { queryCancellationMiddleware } from "./query-cancellation"

export const personDetailInputSchema = z.object({
  personId: z.string().trim().min(1).max(255),
  scenario: fixtureScenarioSchema.optional(),
})

export const getWorkspacePerson = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(personDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspacePerson(data.personId, data.scenario, context.requestSignal)
    )
  })
