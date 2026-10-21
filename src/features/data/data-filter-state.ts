import { publicDataSearchSchema } from "@/data/crucible/public-data"
import type { PublicDataChoice } from "@/data/crucible/public-data"
import { z } from "zod"

import {
  collectionFiltersSchema,
  normalizeCollectionFilters,
} from "@/data/crucible/collection-filters"
import type { CollectionFilters } from "@/data/crucible/collection-filters"
import {
  collectionOrderingSearchState,
  ownershipAffiliationSchema,
  collectionCursorSchema,
  defaultCollectionOrdering,
  normalizeCollectionQueryOptions,
  resourceSortSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import type {
  OwnershipAffiliation,
  CollectionOrdering,
  NormalizedCollectionQueryOptions,
} from "@/data/crucible/collection-query"
import {
  collectionBrowseSearchFields,
  collectionBrowseSearchState,
} from "@/data/crucible/collection-browse"
import type { ProjectScope } from "@/data/crucible/data.queries"
import type {
  DatasetFacetFilters,
  SampleFacetFilters,
} from "@/data/crucible/facets"
import {
  facetFilterSearchFields,
  selectedFacetValue,
} from "@/data/crucible/facet-filter-search"

const filterSearchValue = z.string().max(255).optional().catch("")
const selectedFacetSchema = z
  .union([z.literal(true), z.literal("true")])
  .transform(() => true as const)
  .optional()
  .catch(undefined)

export const dataSearchSchema = z.object({
  ...collectionBrowseSearchFields,
  ...facetFilterSearchFields,
  affiliation: filterSearchValue,
  createdFrom: filterSearchValue,
  createdTo: filterSearchValue,
  datasetCursor: collectionCursorSchema,
  direction: filterSearchValue,
  instrumentMfid: filterSearchValue,
  instrumentMfidIsNull: selectedFacetSchema,
  kind: filterSearchValue,
  projectMfid: filterSearchValue,
  projectScope: filterSearchValue,
  publicData: publicDataSearchSchema.optional().catch(undefined),
  sampleCursor: collectionCursorSchema,
  sort: filterSearchValue,
  visibility: filterSearchValue,
})

export type DataKind = "datasets" | "samples"
export type DataKindFilter = DataKind
export type DataSearch = z.infer<typeof dataSearchSchema>
export type DataFilterSearch = Omit<
  DataSearch,
  | "datasetCursor"
  | "groupBy"
  | "groupValue"
  | "groupValueIsNull"
  | "groupValueSet"
  | "sampleCursor"
  | "view"
>

type ProjectSelection =
  | { projectMfid?: undefined; projectScope?: undefined }
  | { projectMfid: string; projectScope: ProjectScope }

export type DataFilterValues = CollectionFilters &
  DatasetFacetFilters &
  Pick<NormalizedCollectionQueryOptions, "direction" | "sort"> &
  ProjectSelection &
  SampleFacetFilters & {
    affiliation?: OwnershipAffiliation
    instrumentMfid?: string
    kind: DataKindFilter
    publicData?: PublicDataChoice
  }

export type DataFilterField = keyof DataFilterSearch

export type DataFilterError = {
  field: DataFilterField
  message: string
}

export type DataFilterResolution =
  | { filters: DataFilterValues; valid: true }
  | { errors: readonly DataFilterError[]; valid: false }

function collectionOrdering({ direction, sort }: CollectionOrdering) {
  return { direction, sort }
}

const dataKindSchema = z.enum(["samples", "datasets"]).default("samples")
const projectScopeSchema = z.enum(["all", "assigned", "shared"]).optional()
const mfidSchema = z
  .string()
  .trim()
  .min(1, "Choose a resource or clear the filter.")
  .max(255, "The resource identifier is too long.")
  .regex(/^[a-zA-Z0-9_-]+$/, "The resource identifier is not valid.")
  .optional()
const exactFacetValueSchema = z.string().max(255).optional()

const domainFiltersSchema = z
  .object({
    affiliation: ownershipAffiliationSchema.optional(),
    dataFormat: exactFacetValueSchema,
    dataFormatIsNull: z.literal(true).optional(),
    direction: sortDirectionSchema.optional(),
    instrumentMfid: mfidSchema,
    instrumentMfidIsNull: z.literal(true).optional(),
    kind: dataKindSchema,
    measurement: exactFacetValueSchema,
    measurementIsNull: z.literal(true).optional(),
    ownerId: exactFacetValueSchema,
    ownerIdIsNull: z.literal(true).optional(),
    projectMfid: mfidSchema,
    projectScope: projectScopeSchema,
    sampleType: exactFacetValueSchema,
    sampleTypeIsNull: z.literal(true).optional(),
    sessionName: exactFacetValueSchema,
    sessionNameIsNull: z.literal(true).optional(),
    sort: resourceSortSchema.optional(),
  })
  .superRefine((filters, context) => {
    if (filters.instrumentMfid && filters.instrumentMfidIsNull) {
      addIssue(
        context,
        "instrumentMfid",
        "Choose either an instrument or the unspecified bucket."
      )
    }
    if (filters.ownerId !== undefined && filters.ownerIdIsNull) {
      addIssue(
        context,
        "ownerId",
        "Choose either an owner or the unspecified bucket."
      )
    }
    if (filters.projectScope && !filters.projectMfid) {
      addIssue(
        context,
        "projectScope",
        "Choose a project before selecting its relationship."
      )
    }
    if (
      (filters.instrumentMfid || filters.instrumentMfidIsNull) &&
      filters.kind !== "datasets"
    ) {
      addIssue(
        context,
        "instrumentMfid",
        "Acquisition instrument filters apply only to datasets."
      )
    }
    if (filters.direction && !filters.sort) {
      addIssue(
        context,
        "direction",
        "Choose an order before selecting its direction."
      )
    }
    if (
      filters.kind !== "samples" &&
      (filters.sampleType !== undefined || filters.sampleTypeIsNull)
    ) {
      addIssue(
        context,
        "sampleType",
        "Sample type filters apply only to samples."
      )
    }
    if (
      filters.kind !== "datasets" &&
      (filters.dataFormat !== undefined ||
        filters.dataFormatIsNull ||
        filters.measurement !== undefined ||
        filters.measurementIsNull ||
        filters.sessionName !== undefined ||
        filters.sessionNameIsNull)
    ) {
      addIssue(context, "measurement", "Dataset facets apply only to datasets.")
    }
  })

export function resolveDataFilters(
  search: DataSearch,
  defaultOrdering: CollectionOrdering = defaultCollectionOrdering
): DataFilterResolution {
  const collection = collectionFiltersSchema.safeParse({
    createdFrom: search.createdFrom,
    createdTo: search.createdTo,
    visibility: search.visibility,
  })
  const domain = domainFiltersSchema.safeParse({
    affiliation: search.affiliation,
    dataFormat: selectedFacetValue(
      search.dataFormat,
      search.dataFormatSet,
      search.dataFormatIsNull
    ),
    dataFormatIsNull: search.dataFormatIsNull,
    direction: search.direction,
    instrumentMfid: search.instrumentMfid,
    instrumentMfidIsNull: search.instrumentMfidIsNull,
    kind: search.kind,
    measurement: selectedFacetValue(
      search.measurement,
      search.measurementSet,
      search.measurementIsNull
    ),
    measurementIsNull: search.measurementIsNull,
    ownerId: selectedFacetValue(
      search.ownerId,
      search.ownerIdSet,
      search.ownerIdIsNull
    ),
    ownerIdIsNull: search.ownerIdIsNull,
    projectMfid: search.projectMfid,
    projectScope: search.projectScope,
    sampleType: selectedFacetValue(
      search.sampleType,
      search.sampleTypeSet,
      search.sampleTypeIsNull
    ),
    sampleTypeIsNull: search.sampleTypeIsNull,
    sessionName: selectedFacetValue(
      search.sessionName,
      search.sessionNameSet,
      search.sessionNameIsNull
    ),
    sessionNameIsNull: search.sessionNameIsNull,
    sort: search.sort,
  })
  if (!collection.success || !domain.success) {
    const issues = [
      ...(collection.success ? [] : collection.error.issues),
      ...(domain.success ? [] : domain.error.issues),
    ]
    return {
      errors: issues.map((issue) => ({
        field: dataFilterField(issue.path[0]),
        message: issue.message,
      })),
      valid: false,
    }
  }

  const projectSelection = domain.data.projectMfid
    ? {
        projectMfid: domain.data.projectMfid,
        projectScope: domain.data.projectScope ?? "all",
      }
    : {}
  const filters: DataFilterValues = {
    ...normalizeCollectionFilters(collection.data),
    ...projectSelection,
    ...(domain.data.affiliation
      ? { affiliation: domain.data.affiliation }
      : {}),
    ...collectionOrdering(
      normalizeCollectionQueryOptions(
        {
          direction: domain.data.direction,
          sort: domain.data.sort,
        },
        defaultOrdering
      )
    ),
    ...(domain.data.kind === "samples"
      ? {
          ownerId: domain.data.ownerId,
          ownerIdIsNull: domain.data.ownerIdIsNull,
          sampleType: domain.data.sampleType,
          sampleTypeIsNull: domain.data.sampleTypeIsNull,
        }
      : {}),
    ...(domain.data.kind === "datasets"
      ? {
          dataFormat: domain.data.dataFormat,
          dataFormatIsNull: domain.data.dataFormatIsNull,
          instrumentMfid: domain.data.instrumentMfid,
          instrumentMfidIsNull: domain.data.instrumentMfidIsNull,
          measurement: domain.data.measurement,
          measurementIsNull: domain.data.measurementIsNull,
          ownerId: domain.data.ownerId,
          ownerIdIsNull: domain.data.ownerIdIsNull,
          sessionName: domain.data.sessionName,
          sessionNameIsNull: domain.data.sessionNameIsNull,
        }
      : {}),
    kind: domain.data.kind,
    ...(search.publicData ? { publicData: search.publicData } : {}),
  }

  return { filters, valid: true }
}

export function applyDataFilters(
  previous: Readonly<Record<string, unknown> & DataSearch>,
  filters: DataFilterValues,
  defaultOrdering: CollectionOrdering = defaultCollectionOrdering
) {
  const ordering = collectionOrderingSearchState(
    filters.sort,
    filters.direction,
    defaultOrdering
  )
  return {
    ...previous,
    ...(previous.view !== "list"
      ? collectionBrowseSearchState({ kind: "all" })
      : {}),
    affiliation: filters.affiliation,
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
    ...facetSearchState(filters),
    datasetCursor: undefined,
    direction: ordering.direction,
    instrumentMfid:
      filters.kind === "datasets" ? filters.instrumentMfid : undefined,
    instrumentMfidIsNull:
      filters.kind === "datasets" ? filters.instrumentMfidIsNull : undefined,
    kind: filters.kind === "samples" ? undefined : filters.kind,
    projectMfid: filters.projectMfid,
    projectScope:
      filters.projectScope === "all" ? undefined : filters.projectScope,
    preview: undefined,
    publicData: filters.publicData,
    sampleCursor: undefined,
    sort: ordering.sort,
    visibility: filters.visibility,
  }
}

export function clearDataFilters(
  previous: Readonly<Record<string, unknown> & DataSearch>
) {
  return {
    ...previous,
    affiliation: undefined,
    createdFrom: undefined,
    createdTo: undefined,
    ...emptyFacetSearchState,
    datasetCursor: undefined,
    direction: undefined,
    instrumentMfid: undefined,
    instrumentMfidIsNull: undefined,
    ownerId: undefined,
    ownerIdIsNull: undefined,
    ownerIdSet: undefined,
    kind: previous.kind === "datasets" ? "datasets" : undefined,
    projectMfid: undefined,
    projectScope: undefined,
    preview: undefined,
    publicData: undefined,
    sampleCursor: undefined,
    sort: undefined,
    visibility: undefined,
  }
}

export function switchDataKind(
  previous: Readonly<Record<string, unknown> & DataSearch>,
  kind: DataKindFilter
) {
  return {
    ...previous,
    ...facetSearchStateForKind(previous, kind),
    datasetCursor: undefined,
    direction: previous.direction,
    instrumentMfid: kind === "datasets" ? previous.instrumentMfid : undefined,
    instrumentMfidIsNull:
      kind === "datasets" ? previous.instrumentMfidIsNull : undefined,
    kind: kind === "samples" ? undefined : kind,
    groupBy: undefined,
    groupValue: undefined,
    groupValueIsNull: undefined,
    groupValueSet: undefined,
    preview: undefined,
    sampleCursor: undefined,
    sort: previous.sort,
    view: previous.view,
  }
}

export function setDataFilterProject(
  filters: DataFilterSearch,
  projectMfid: string | undefined
): DataFilterSearch {
  const normalized = projectMfid?.trim() || undefined
  return {
    ...filters,
    projectMfid: normalized,
    projectScope: normalized ? filters.projectScope : undefined,
  }
}

function facetSearchState(filters: DataFilterValues) {
  return {
    dataFormat: filters.dataFormat,
    dataFormatIsNull: filters.dataFormatIsNull,
    dataFormatSet: filters.dataFormat !== undefined || undefined,
    measurement: filters.measurement,
    measurementIsNull: filters.measurementIsNull,
    measurementSet: filters.measurement !== undefined || undefined,
    ownerId: filters.ownerId,
    ownerIdIsNull: filters.ownerIdIsNull,
    ownerIdSet: filters.ownerId !== undefined || undefined,
    sampleType: filters.sampleType,
    sampleTypeIsNull: filters.sampleTypeIsNull,
    sampleTypeSet: filters.sampleType !== undefined || undefined,
    sessionName: filters.sessionName,
    sessionNameIsNull: filters.sessionNameIsNull,
    sessionNameSet: filters.sessionName !== undefined || undefined,
  }
}

const emptyFacetSearchState = {
  dataFormat: undefined,
  dataFormatIsNull: undefined,
  dataFormatSet: undefined,
  measurement: undefined,
  measurementIsNull: undefined,
  measurementSet: undefined,
  ownerId: undefined,
  ownerIdIsNull: undefined,
  ownerIdSet: undefined,
  sampleType: undefined,
  sampleTypeIsNull: undefined,
  sampleTypeSet: undefined,
  sessionName: undefined,
  sessionNameIsNull: undefined,
  sessionNameSet: undefined,
}

function facetSearchStateForKind(search: DataSearch, kind: DataKindFilter) {
  return {
    ...emptyFacetSearchState,
    ...(kind === "samples"
      ? {
          sampleType: search.sampleType,
          sampleTypeIsNull: search.sampleTypeIsNull,
          sampleTypeSet: search.sampleTypeSet,
          ownerId: search.ownerId,
          ownerIdIsNull: search.ownerIdIsNull,
          ownerIdSet: search.ownerIdSet,
        }
      : {}),
    ...(kind === "datasets"
      ? {
          dataFormat: search.dataFormat,
          dataFormatIsNull: search.dataFormatIsNull,
          dataFormatSet: search.dataFormatSet,
          measurement: search.measurement,
          measurementIsNull: search.measurementIsNull,
          measurementSet: search.measurementSet,
          ownerId: search.ownerId,
          ownerIdIsNull: search.ownerIdIsNull,
          ownerIdSet: search.ownerIdSet,
          sessionName: search.sessionName,
          sessionNameIsNull: search.sessionNameIsNull,
          sessionNameSet: search.sessionNameSet,
        }
      : {}),
  }
}

function addIssue(
  context: z.RefinementCtx,
  path: DataFilterField,
  message: string
) {
  context.addIssue({ code: "custom", message, path: [path] })
}

function dataFilterField(field: PropertyKey | undefined): DataFilterField {
  return typeof field === "string" && field in dataSearchSchema.shape
    ? (field as DataFilterField)
    : "kind"
}
