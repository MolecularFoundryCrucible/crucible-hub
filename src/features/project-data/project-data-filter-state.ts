import { z } from "zod"

import {
  collectionFiltersSchema,
  normalizeCollectionFilters,
} from "@/data/crucible/collection-filters"
import type { CollectionFilters } from "@/data/crucible/collection-filters"
import {
  normalizeCollectionQueryOptions,
  resourceSortSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import type { NormalizedCollectionQueryOptions } from "@/data/crucible/collection-query"
import type {
  DatasetFacetFilters,
  SampleFacetFilters,
} from "@/data/crucible/facets"
import { selectedFacetValue } from "@/data/crucible/facet-filter-search"

const instrumentMfidSchema = z
  .string()
  .min(1, "Choose an acquisition instrument or clear the filter.")
  .max(255, "The acquisition instrument identifier is too long.")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "The acquisition instrument identifier is not valid."
  )
  .optional()

const exactFacetValueSchema = z.string().max(255).optional()

export type ProjectDataFilterSearch = {
  createdFrom?: string
  createdTo?: string
  dataFormat?: string
  dataFormatIsNull?: true
  dataFormatSet?: true
  direction?: string
  instrumentMfid?: string
  instrumentMfidIsNull?: true
  measurement?: string
  measurementIsNull?: true
  measurementSet?: true
  ownerId?: string
  ownerIdIsNull?: true
  ownerIdSet?: true
  sampleType?: string
  sampleTypeIsNull?: true
  sampleTypeSet?: true
  sessionName?: string
  sessionNameIsNull?: true
  sessionNameSet?: true
  sort?: string
  visibility?: string
}

export type ProjectDataCollectionFilters = CollectionFilters &
  DatasetFacetFilters &
  Pick<NormalizedCollectionQueryOptions, "direction" | "sort"> &
  SampleFacetFilters & {
    instrumentMfid?: string
  }

export type ProjectDataFilterError = {
  field: keyof ProjectDataFilterSearch
  message: string
}

export type ProjectDataFilterResolution =
  | { filters: ProjectDataCollectionFilters; valid: true }
  | { errors: readonly ProjectDataFilterError[]; valid: false }

const domainFiltersSchema = z
  .object({
    dataFormat: exactFacetValueSchema,
    dataFormatIsNull: z.literal(true).optional(),
    direction: sortDirectionSchema.optional(),
    instrumentMfid: instrumentMfidSchema,
    instrumentMfidIsNull: z.literal(true).optional(),
    measurement: exactFacetValueSchema,
    measurementIsNull: z.literal(true).optional(),
    ownerId: exactFacetValueSchema,
    ownerIdIsNull: z.literal(true).optional(),
    sampleType: exactFacetValueSchema,
    sampleTypeIsNull: z.literal(true).optional(),
    sessionName: exactFacetValueSchema,
    sessionNameIsNull: z.literal(true).optional(),
    sort: resourceSortSchema.optional(),
  })
  .superRefine((filters, context) => {
    if (filters.instrumentMfid && filters.instrumentMfidIsNull) {
      context.addIssue({
        code: "custom",
        message: "Choose either an instrument or the unspecified bucket.",
        path: ["instrumentMfid"],
      })
    }
    if (filters.ownerId !== undefined && filters.ownerIdIsNull) {
      context.addIssue({
        code: "custom",
        message: "Choose either an owner or the unspecified bucket.",
        path: ["ownerId"],
      })
    }
    if (filters.direction && !filters.sort) {
      context.addIssue({
        code: "custom",
        message: "Choose an order before selecting its direction.",
        path: ["direction"],
      })
    }
  })

export function resolveProjectDataFilters(
  search: ProjectDataFilterSearch,
  kind: "datasets" | "samples"
): ProjectDataFilterResolution {
  const collection = collectionFiltersSchema.safeParse({
    createdFrom: search.createdFrom,
    createdTo: search.createdTo,
    visibility: search.visibility,
  })
  const domain = domainFiltersSchema.safeParse({
    dataFormat: selectedFacetValue(
      search.dataFormat,
      search.dataFormatSet,
      search.dataFormatIsNull
    ),
    dataFormatIsNull: search.dataFormatIsNull,
    direction: search.direction,
    instrumentMfid: search.instrumentMfid,
    instrumentMfidIsNull: search.instrumentMfidIsNull,
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
  const issues = [
    ...(collection.success ? [] : collection.error.issues),
    ...(domain.success ? [] : domain.error.issues),
  ]
  if (
    kind === "samples" &&
    (search.instrumentMfid !== undefined ||
      search.instrumentMfidIsNull ||
      search.dataFormatSet ||
      search.dataFormatIsNull ||
      search.measurementSet ||
      search.measurementIsNull ||
      search.sessionNameSet ||
      search.sessionNameIsNull)
  ) {
    issues.push({
      code: "custom",
      message: "Dataset filters apply only to datasets.",
      path: ["instrumentMfid"],
    })
  }
  if (
    kind === "datasets" &&
    (search.sampleTypeSet || search.sampleTypeIsNull)
  ) {
    issues.push({
      code: "custom",
      message: "Sample type filters apply only to samples.",
      path: ["sampleType"],
    })
  }
  if (issues.length || !collection.success || !domain.success) {
    return {
      errors: issues.map((issue) => ({
        field: issue.path[0] as keyof ProjectDataFilterSearch,
        message: issue.message,
      })),
      valid: false,
    }
  }

  return {
    filters: {
      ...normalizeCollectionFilters(collection.data),
      ...normalizeCollectionQueryOptions({
        direction: domain.data.direction,
        sort: domain.data.sort,
      }),
      ...(kind === "samples"
        ? {
            sampleType: domain.data.sampleType,
            sampleTypeIsNull: domain.data.sampleTypeIsNull,
            ownerId: domain.data.ownerId,
            ownerIdIsNull: domain.data.ownerIdIsNull,
          }
        : {
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
          }),
    },
    valid: true,
  }
}
