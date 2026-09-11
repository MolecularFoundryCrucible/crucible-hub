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
import {
  readWorkspaceDatasetFacets,
  readWorkspaceDatasets,
  readWorkspaceSampleFacets,
  readWorkspaceSamples,
} from "./data.server"
import { queryCancellationMiddleware } from "./query-cancellation"
import { fixtureScenarioSchema } from "./fixture-scenarios"
import { datasetFacetFieldSchema, sampleFacetFieldSchema } from "./facets"

export const projectScopeSchema = z.enum(["all", "assigned", "shared"])
const nullSelector = z.literal(true).optional()

const cursorPageInputFields = {
  ...collectionFilterFields,
  affiliation: collectionAffiliationSchema.optional(),
  cursor: z.string().min(1).max(4096).optional(),
  direction: sortDirectionSchema.optional(),
  limit: z.number().int().min(1).max(100),
  projectMfid: z.string().trim().min(1).max(255).optional(),
  projectMfidIsNull: nullSelector,
  projectScope: projectScopeSchema.optional(),
  scenario: fixtureScenarioSchema.optional(),
  sort: resourceSortSchema.optional(),
}

const nullableFacetFilter = z.string().max(255).optional()

const sampleFacetFilterFields = {
  ownerId: nullableFacetFilter,
  ownerIdIsNull: nullSelector,
  sampleType: nullableFacetFilter,
  sampleTypeIsNull: nullSelector,
}

const datasetFacetFilterFields = {
  dataFormat: nullableFacetFilter,
  dataFormatIsNull: nullSelector,
  instrumentMfidIsNull: nullSelector,
  measurement: nullableFacetFilter,
  measurementIsNull: nullSelector,
  ownerId: nullableFacetFilter,
  ownerIdIsNull: nullSelector,
  sessionName: nullableFacetFilter,
  sessionNameIsNull: nullSelector,
}

function validateProjectScope(
  input: {
    projectMfid?: string
    projectMfidIsNull?: true
    projectScope?: string
  },
  context: z.RefinementCtx
) {
  if (input.projectScope && !input.projectMfid) {
    context.addIssue({
      code: "custom",
      message: "A project MFID is required when selecting a project scope.",
      path: ["projectScope"],
    })
  }
  if (input.projectMfid && input.projectMfidIsNull) {
    context.addIssue({
      code: "custom",
      message: "Choose either a project or the unspecified bucket.",
      path: ["projectMfid"],
    })
  }
}

function normalizeProjectScope<
  TInput extends {
    createdFrom?: string
    createdTo?: string
    projectMfid?: string
    projectMfidIsNull?: true
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
  validateFacetSelections(input, context)
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

function validateFacetSelections(
  input: Record<string, unknown>,
  context: z.RefinementCtx
) {
  const pairs = [
    ["dataFormat", "dataFormatIsNull"],
    ["measurement", "measurementIsNull"],
    ["ownerId", "ownerIdIsNull"],
    ["sampleType", "sampleTypeIsNull"],
    ["sessionName", "sessionNameIsNull"],
  ] as const
  for (const [valueKey, nullKey] of pairs) {
    if (input[valueKey] !== undefined && input[nullKey] === true) {
      context.addIssue({
        code: "custom",
        message: "Choose either an exact value or the unspecified bucket.",
        path: [valueKey],
      })
    }
  }
}

export const cursorPageInputSchema = z
  .object({ ...cursorPageInputFields, ...sampleFacetFilterFields })
  .superRefine(validateCursorInput)
  .transform(normalizeProjectScope)

export const datasetCursorPageInputSchema = z
  .object({
    ...cursorPageInputFields,
    ...datasetFacetFilterFields,
    instrumentMfid: z.string().trim().min(1).max(255).optional(),
  })
  .superRefine(validateCursorInput)
  .transform(normalizeProjectScope)

const facetPageInputFields = {
  ...collectionFilterFields,
  affiliation: collectionAffiliationSchema.optional(),
  cursor: z.string().min(1).max(4096).optional(),
  limit: z.number().int().min(1).max(1000),
  projectMfid: z.string().trim().min(1).max(255).optional(),
  projectMfidIsNull: nullSelector,
  projectScope: projectScopeSchema.optional(),
  scenario: fixtureScenarioSchema.optional(),
}

export const sampleFacetPageInputSchema = z
  .object({
    ...facetPageInputFields,
    ...sampleFacetFilterFields,
    field: sampleFacetFieldSchema,
  })
  .superRefine((input, context) => {
    validateProjectScope(input, context)
    validateFacetSelections(input, context)
  })
  .transform(normalizeProjectScope)

export const datasetFacetPageInputSchema = z
  .object({
    ...facetPageInputFields,
    ...datasetFacetFilterFields,
    field: datasetFacetFieldSchema,
    instrumentMfid: z.string().trim().min(1).max(255).optional(),
  })
  .superRefine((input, context) => {
    validateProjectScope(input, context)
    validateFacetSelections(input, context)
  })
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

export const getWorkspaceSampleFacets = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(sampleFacetPageInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceSampleFacets(data, context.requestSignal)
    )
  })

export const getWorkspaceDatasetFacets = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(datasetFacetPageInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceDatasetFacets(data, context.requestSignal)
    )
  })
