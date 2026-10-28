import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"
import { searchWorkspace, searchWorkspaceMetadata } from "./search.server"

const searchKindSchema = z.enum([
  "dataset",
  "instrument",
  "person",
  "project",
  "sample",
])

const searchInputSchema = z.object({
  affiliation: z.enum(["member", "owner"]).optional(),
  kinds: z.array(searchKindSchema).min(1).max(5),
  limit: z.number().int().min(1).max(50),
  projectMfid: z.string().trim().min(1).max(255).optional(),
  query: z.string().trim().max(200),
  scenario: fixtureScenarioSchema.optional(),
  serviceAccountsOnly: z.boolean().optional(),
})

export const getWorkspaceSearch = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(searchInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      searchWorkspace(data, context.requestSignal)
    )
  })

export const getWorkspaceMetadataSearch = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z.object({
      affiliation: z.enum(["member", "owner"]).optional(),
      limit: z.number().int().min(1).max(50),
      query: z.string().trim().min(3).max(200),
      scenario: fixtureScenarioSchema.optional(),
    })
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      searchWorkspaceMetadata(data, context.requestSignal)
    )
  })
