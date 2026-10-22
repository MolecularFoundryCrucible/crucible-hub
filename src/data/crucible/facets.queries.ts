import { infiniteQueryOptions } from "@tanstack/react-query"

import type { CollectionFilters } from "./collection-filters"
import { normalizeCollectionFilters } from "./collection-filters"
import type { CollectionQueryOptions } from "./collection-query"
import {
  getWorkspaceDatasetFacets,
  getWorkspaceSampleFacets,
} from "./data.functions"
import type { ProjectScope } from "./data.queries"
import {
  normalizeDatasetFacetFilters,
  normalizeSampleFacetFilters,
} from "./facets"
import type {
  DatasetFacetField,
  DatasetFacetFilters,
  FacetOrdering,
  SampleFacetField,
  SampleFacetFilters,
} from "./facets"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { sameKindPreviousData } from "./pagination"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export const facetPageLimit = 100

export type FacetContext = CollectionFilters &
  Pick<CollectionQueryOptions, "affiliation"> & {
    instrumentMfid?: string
    instrumentMfidIsNull?: true
    ownerId?: string
    ownerIdIsNull?: true
    projectMfid?: string
    projectMfidIsNull?: true
    projectScope?: ProjectScope
  }

export function sampleFacetQueryOptions(
  scope: IdentityScope,
  field: SampleFacetField,
  filters: FacetContext & SampleFacetFilters,
  options: { excludeField?: boolean; ordering?: FacetOrdering } = {}
) {
  const excludeField = options.excludeField ?? true
  const facetFilters = normalizeSampleFacetFilters(filters)
  const context = {
    ...normalizeFacetContext(filters, excludeField && field === "project"),
    ...(excludeField
      ? withoutSampleFacetField(field, facetFilters)
      : facetFilters),
  }
  const ordering = options.ordering ?? { direction: "asc", sort: "label" }
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryKey: crucibleKeys.sampleFacets(scope, {
      facetDirection: ordering.direction,
      facetSort: ordering.sort,
      field,
      ...context,
    }),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceSampleFacets({
          data: {
            ...context,
            cursor: pageParam,
            direction: ordering.direction,
            field,
            limit: facetPageLimit,
            scenario: fixtureScenarioFromScope(scope),
            sort: ordering.sort,
          },
          signal,
        })
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    placeholderData: (previousData, previousQuery) =>
      sameKindPreviousData(scope, { field }, previousData, previousQuery),
  })
}

export function datasetFacetQueryOptions(
  scope: IdentityScope,
  field: DatasetFacetField,
  filters: FacetContext & DatasetFacetFilters,
  options: { excludeField?: boolean; ordering?: FacetOrdering } = {}
) {
  const excludeField = options.excludeField ?? true
  const facetFilters = {
    ...normalizeDatasetFacetFilters(filters),
    instrumentMfid: filters.instrumentMfid,
    instrumentMfidIsNull: filters.instrumentMfidIsNull,
  }
  const context = {
    ...normalizeFacetContext(filters, excludeField && field === "project"),
    ...(excludeField
      ? withoutDatasetFacetField(field, facetFilters)
      : facetFilters),
  }
  const ordering = options.ordering ?? { direction: "asc", sort: "label" }
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryKey: crucibleKeys.datasetFacets(scope, {
      facetDirection: ordering.direction,
      facetSort: ordering.sort,
      field,
      ...context,
    }),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceDatasetFacets({
          data: {
            ...context,
            cursor: pageParam,
            direction: ordering.direction,
            field,
            limit: facetPageLimit,
            scenario: fixtureScenarioFromScope(scope),
            sort: ordering.sort,
          },
          signal,
        })
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    placeholderData: (previousData, previousQuery) =>
      sameKindPreviousData(scope, { field }, previousData, previousQuery),
  })
}

function normalizeFacetContext(filters: FacetContext, omitProject: boolean) {
  return {
    ...normalizeCollectionFilters(filters),
    ...(filters.affiliation ? { affiliation: filters.affiliation } : {}),
    ...(!omitProject && filters.projectMfid
      ? {
          projectMfid: filters.projectMfid,
          projectScope: filters.projectScope ?? "all",
        }
      : !omitProject && filters.projectMfidIsNull
        ? { projectMfidIsNull: true as const }
        : {}),
  }
}

function withoutSampleFacetField(
  field: SampleFacetField,
  filters: SampleFacetFilters
) {
  const { ownerId, ownerIdIsNull, sampleType, sampleTypeIsNull } = filters
  return field === "owner"
    ? { sampleType, sampleTypeIsNull }
    : { ownerId, ownerIdIsNull }
}

function withoutDatasetFacetField(
  field: DatasetFacetField,
  filters: DatasetFacetFilters &
    Pick<FacetContext, "instrumentMfid" | "instrumentMfidIsNull">
) {
  const {
    dataFormat,
    dataFormatIsNull,
    measurement,
    measurementIsNull,
    ownerId,
    ownerIdIsNull,
    sessionName,
    sessionNameIsNull,
  } = filters
  const instrument = filters.instrumentMfid
    ? { instrumentMfid: filters.instrumentMfid }
    : filters.instrumentMfidIsNull
      ? { instrumentMfidIsNull: true as const }
      : {}
  if (field === "owner") {
    return {
      dataFormat,
      dataFormatIsNull,
      ...instrument,
      measurement,
      measurementIsNull,
      sessionName,
      sessionNameIsNull,
    }
  }
  if (field === "instrument") {
    return {
      dataFormat,
      dataFormatIsNull,
      measurement,
      measurementIsNull,
      ownerId,
      ownerIdIsNull,
      sessionName,
      sessionNameIsNull,
    }
  }
  if (field === "data_format") {
    return {
      measurement,
      measurementIsNull,
      ...instrument,
      ownerId,
      ownerIdIsNull,
      sessionName,
      sessionNameIsNull,
    }
  }
  if (field === "measurement") {
    return {
      dataFormat,
      dataFormatIsNull,
      ...instrument,
      ownerId,
      ownerIdIsNull,
      sessionName,
      sessionNameIsNull,
    }
  }
  return {
    dataFormat,
    dataFormatIsNull,
    ...instrument,
    measurement,
    measurementIsNull,
    ownerId,
    ownerIdIsNull,
  }
}
