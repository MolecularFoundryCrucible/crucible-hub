import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { readWorkspace } from "@/data/crucible/workspace.server"
import { queryCancellationMiddleware } from "@/data/crucible/query-cancellation"

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ scenario: fixtureScenarioSchema.optional() }))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return readWorkspace(data.scenario, context.requestSignal)
  })
