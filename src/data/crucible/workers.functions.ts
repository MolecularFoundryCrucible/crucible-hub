import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"
import { readWorkspaceWorkers } from "./workers.server"

export const getWorkspaceWorkers = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ scenario: fixtureScenarioSchema.optional() }).strict())
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceWorkers(data.scenario, context.requestSignal)
    )
  })
