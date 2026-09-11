import { queryOptions } from "@tanstack/react-query"

import type { CollectionFilters } from "./collection-filters"
import { normalizeCollectionFilters } from "./collection-filters"
import type { CollectionQueryOptions } from "./collection-query"
import { normalizeCollectionQueryOptions } from "./collection-query"
import { getWorkspaceDatasets, getWorkspaceSamples } from "./data.functions"
import {
  normalizeDatasetFacetFilters,
  normalizeSampleFacetFilters,
} from "./facets"
import type { DatasetFacetFilters, SampleFacetFilters } from "./facets"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export const dataPageLimit = 50

export type ProjectScope = "all" | "assigned" | "shared"

type ProjectFilters =
  | {
      projectMfid?: undefined
      projectMfidIsNull?: undefined
      projectScope?: undefined
    }
  | {
      projectMfid: string
      projectMfidIsNull?: undefined
      projectScope?: ProjectScope
    }
  | {
      projectMfid?: undefined
      projectMfidIsNull: true
      projectScope?: undefined
    }

export type CursorFilters = ProjectFilters &
  CollectionFilters &
  CollectionQueryOptions & {
    cursor?: string
    limit: number
  } & SampleFacetFilters

export type DatasetCursorFilters = ProjectFilters &
  CollectionFilters &
  CollectionQueryOptions &
  DatasetFacetFilters & {
    cursor?: string
    instrumentMfid?: string
    instrumentMfidIsNull?: true
    ownerId?: string
    ownerIdIsNull?: true
    limit: number
  }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function collectionScopedPreviousData<TData>(
  scope: IdentityScope,
  family: "datasets" | "samples",
  filters: {
    createdFrom?: string
    createdTo?: string
    instrumentMfid?: string
    instrumentMfidIsNull?: true
    ownerId?: string
    ownerIdIsNull?: true
    projectMfid?: string
    projectMfidIsNull?: true
    projectScope?: ProjectScope
    sampleType?: string
    sampleTypeIsNull?: true
    dataFormat?: string
    dataFormatIsNull?: true
    measurement?: string
    measurementIsNull?: true
    sessionName?: string
    sessionNameIsNull?: true
    visibility?: "all" | "public" | "private"
    affiliation?: "owner"
    direction?: "asc" | "desc"
    sort?: "created" | "name" | "updated"
  },
  previousData: TData | undefined,
  previousQuery: { queryKey: readonly unknown[] } | undefined
) {
  const queryKey = previousQuery?.queryKey
  const previousFilters = queryKey?.[5]
  const contextKeys = [
    "affiliation",
    "createdFrom",
    "createdTo",
    "direction",
    "dataFormat",
    "dataFormatIsNull",
    "instrumentMfid",
    "instrumentMfidIsNull",
    "projectMfid",
    "projectMfidIsNull",
    "projectScope",
    "measurement",
    "measurementIsNull",
    "ownerId",
    "ownerIdIsNull",
    "sampleType",
    "sampleTypeIsNull",
    "sessionName",
    "sessionNameIsNull",
    "sort",
    "visibility",
  ] as const

  return queryKey?.[0] === scope[0] &&
    queryKey[1] === scope[1] &&
    queryKey[2] === scope[2] &&
    queryKey[3] === family &&
    queryKey[4] === "list" &&
    contextKeys.every(
      (key) =>
        (isRecord(previousFilters) ? previousFilters[key] : undefined) ===
        filters[key]
    )
    ? previousData
    : undefined
}

export function datasetInstrumentScopedPreviousData<TData>(
  scope: IdentityScope,
  instrumentMfid: string | undefined,
  previousData: TData | undefined,
  previousQuery: { queryKey: readonly unknown[] } | undefined,
  projectMfid?: string,
  projectScope?: ProjectScope,
  collectionFilters: CollectionFilters = {},
  collectionQuery: CollectionQueryOptions & DatasetFacetFilters = {}
) {
  const normalizedCollectionFilters =
    normalizeCollectionFilters(collectionFilters)
  return collectionScopedPreviousData(
    scope,
    "datasets",
    {
      instrumentMfid,
      projectMfid,
      projectScope,
      ...normalizedCollectionFilters,
      ...normalizeCollectionQueryOptions(collectionQuery),
      ...normalizeDatasetFacetFilters(collectionQuery),
    },
    previousData,
    previousQuery
  )
}

function normalizeInstrumentMfid(instrumentMfid: string | undefined) {
  if (instrumentMfid === undefined) return undefined
  const normalized = instrumentMfid.trim()
  if (!normalized || normalized.length > 255) {
    throw new Error("The instrument MFID must contain 1 to 255 characters.")
  }
  return normalized
}

type NormalizedProjectFilters = {
  projectMfid?: string
  projectMfidIsNull?: true
  projectScope?: ProjectScope
}

function normalizeProjectFilters(
  filters: ProjectFilters
): NormalizedProjectFilters {
  const projectMfid = filters.projectMfid?.trim() || undefined
  if (filters.projectMfid !== undefined && !projectMfid) {
    throw new Error("The project MFID must not be empty.")
  }
  if (!projectMfid && filters.projectScope) {
    throw new Error(
      "A project MFID is required when selecting a project scope."
    )
  }
  if (projectMfid && filters.projectMfidIsNull) {
    throw new Error("Choose either a project or the unspecified bucket.")
  }
  return projectMfid
    ? { projectMfid, projectScope: filters.projectScope ?? "all" }
    : filters.projectMfidIsNull
      ? { projectMfidIsNull: true }
      : {}
}

export function samplesQueryOptions(
  scope: IdentityScope,
  filters: CursorFilters
) {
  const scenario = fixtureScenarioFromScope(scope)
  const projectFilters = normalizeProjectFilters(filters)
  const collectionFilters = normalizeCollectionFilters(filters)
  const collectionQuery = normalizeCollectionQueryOptions(filters)
  const facetFilters = normalizeSampleFacetFilters(filters)
  return queryOptions({
    queryKey: crucibleKeys.samples(scope, {
      cursor: filters.cursor ?? null,
      limit: filters.limit,
      ...projectFilters,
      ...collectionFilters,
      ...collectionQuery,
      ...facetFilters,
    }),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceSamples({
          data: {
            cursor: filters.cursor,
            limit: filters.limit,
            ...projectFilters,
            ...collectionFilters,
            ...collectionQuery,
            ...facetFilters,
            scenario,
          },
          signal,
        })
      ),
    placeholderData: (previousData, previousQuery) =>
      collectionScopedPreviousData(
        scope,
        "samples",
        {
          ...projectFilters,
          ...collectionFilters,
          ...collectionQuery,
          ...facetFilters,
        },
        previousData,
        previousQuery
      ),
    retry: scenario ? false : undefined,
  })
}

export function datasetsQueryOptions(
  scope: IdentityScope,
  filters: DatasetCursorFilters
) {
  const scenario = fixtureScenarioFromScope(scope)
  const instrumentMfid = normalizeInstrumentMfid(filters.instrumentMfid)
  const projectFilters = normalizeProjectFilters(filters)
  const collectionFilters = normalizeCollectionFilters(filters)
  const collectionQuery = normalizeCollectionQueryOptions(filters)
  const facetFilters = normalizeDatasetFacetFilters(filters)
  const keyFilters = {
    cursor: filters.cursor ?? null,
    limit: filters.limit,
    ...(instrumentMfid ? { instrumentMfid } : {}),
    ...projectFilters,
    ...collectionFilters,
    ...collectionQuery,
    ...facetFilters,
  }
  return queryOptions({
    queryKey: crucibleKeys.datasets(scope, keyFilters),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceDatasets({
          data: {
            cursor: filters.cursor,
            limit: filters.limit,
            ...(instrumentMfid ? { instrumentMfid } : {}),
            ...projectFilters,
            ...collectionFilters,
            ...collectionQuery,
            ...facetFilters,
            scenario,
          },
          signal,
        })
      ),
    placeholderData: (previousData, previousQuery) =>
      datasetInstrumentScopedPreviousData(
        scope,
        instrumentMfid,
        previousData,
        previousQuery,
        projectFilters.projectMfid,
        projectFilters.projectScope,
        collectionFilters,
        { ...collectionQuery, ...facetFilters }
      ),
    retry: scenario ? false : undefined,
  })
}
