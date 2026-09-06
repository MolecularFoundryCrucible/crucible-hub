import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { readWorkspaceAccount } from "./account.server"
import { queryCancellationMiddleware } from "./query-cancellation"

export const getWorkspaceAccount = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ scenario: fixtureScenarioSchema.optional() }))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceAccount(data.scenario, context.requestSignal)
    )
  })
