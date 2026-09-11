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
  SampleFacetField,
  SampleFacetFilters,
} from "./facets"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
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
    projectScope?: ProjectScope
  }

export function sampleFacetQueryOptions(
  scope: IdentityScope,
  field: SampleFacetField,
  filters: FacetContext & SampleFacetFilters
) {
  const context = {
    ...normalizeFacetContext(filters),
    ...withoutSampleFacetField(field, normalizeSampleFacetFilters(filters)),
  }
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryKey: crucibleKeys.sampleFacets(scope, { field, ...context }),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceSampleFacets({
          data: {
            ...context,
            cursor: pageParam,
            field,
            limit: facetPageLimit,
            scenario: fixtureScenarioFromScope(scope),
          },
          signal,
        })
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
}

export function datasetFacetQueryOptions(
  scope: IdentityScope,
  field: DatasetFacetField,
  filters: FacetContext & DatasetFacetFilters
) {
  const context = {
    ...normalizeFacetContext(filters),
    ...withoutDatasetFacetField(field, {
      ...normalizeDatasetFacetFilters(filters),
      instrumentMfid: filters.instrumentMfid,
      instrumentMfidIsNull: filters.instrumentMfidIsNull,
    }),
  }
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryKey: crucibleKeys.datasetFacets(scope, { field, ...context }),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceDatasetFacets({
          data: {
            ...context,
            cursor: pageParam,
            field,
            limit: facetPageLimit,
            scenario: fixtureScenarioFromScope(scope),
          },
          signal,
        })
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
}

function normalizeFacetContext(filters: FacetContext) {
  return {
    ...normalizeCollectionFilters(filters),
    ...(filters.affiliation ? { affiliation: filters.affiliation } : {}),
    ...(filters.projectMfid
      ? {
          projectMfid: filters.projectMfid,
          projectScope: filters.projectScope ?? "all",
        }
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
