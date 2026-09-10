import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import {
  collectionFilterFields,
  normalizeCollectionFilters,
} from "./collection-filters"
import {
  collectionAffiliationSchema,
  resourceSortSchema,
  sortDirectionSchema,
} from "./collection-query"
import { readWorkspaceDatasets, readWorkspaceSamples } from "./data.server"
import { queryCancellationMiddleware } from "./query-cancellation"
import { fixtureScenarioSchema } from "./fixture-scenarios"

export const projectScopeSchema = z.enum(["all", "assigned", "shared"])

const cursorPageInputFields = {
  ...collectionFilterFields,
  affiliation: collectionAffiliationSchema.optional(),
  cursor: z.string().min(1).max(4096).optional(),
  direction: sortDirectionSchema.optional(),
  limit: z.number().int().min(1).max(100),
  projectMfid: z.string().trim().min(1).max(255).optional(),
  projectScope: projectScopeSchema.optional(),
  scenario: fixtureScenarioSchema.optional(),
  sort: resourceSortSchema.optional(),
}

function validateProjectScope(
  input: { projectMfid?: string; projectScope?: string },
  context: z.RefinementCtx
) {
  if (input.projectScope && !input.projectMfid) {
    context.addIssue({
      code: "custom",
      message: "A project MFID is required when selecting a project scope.",
      path: ["projectScope"],
    })
  }
}

function normalizeProjectScope<
  TInput extends {
    createdFrom?: string
    createdTo?: string
    projectMfid?: string
    projectScope?: string
    visibility?: "all" | "public" | "private"
  },
>(input: TInput) {
  const { createdFrom, createdTo, visibility, ...rest } = input
  return {
    ...rest,
    ...(input.projectMfid ? { projectScope: input.projectScope ?? "all" } : {}),
    ...normalizeCollectionFilters({ createdFrom, createdTo, visibility }),
  }
}

function validateCursorInput(
  input: {
    createdFrom?: string
    createdTo?: string
    direction?: string
    projectMfid?: string
    projectScope?: string
    sort?: string
    visibility?: string
  },
  context: z.RefinementCtx
) {
  validateProjectScope(input, context)
  if (
    input.createdFrom &&
    input.createdTo &&
    input.createdFrom > input.createdTo
  ) {
    context.addIssue({
      code: "custom",
      message: "The start date must not be after the end date.",
      path: ["createdTo"],
    })
  }
  if (input.direction && !input.sort) {
    context.addIssue({
      code: "custom",
      message: "A sort field is required when selecting a direction.",
      path: ["direction"],
    })
  }
}

export const cursorPageInputSchema = z
  .object(cursorPageInputFields)
  .superRefine(validateCursorInput)
  .transform(normalizeProjectScope)

export const datasetCursorPageInputSchema = z
  .object({
    ...cursorPageInputFields,
    instrumentMfid: z.string().trim().min(1).max(255).optional(),
  })
  .superRefine(validateCursorInput)
  .transform(normalizeProjectScope)

export const getWorkspaceSamples = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(cursorPageInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceSamples(data, context.requestSignal)
    )
  })

export const getWorkspaceDatasets = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(datasetCursorPageInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceDatasets(data, context.requestSignal)
    )
  })
