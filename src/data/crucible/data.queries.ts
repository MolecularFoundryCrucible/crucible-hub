import { queryOptions } from "@tanstack/react-query"

import type { CollectionFilters } from "./collection-filters"
import { normalizeCollectionFilters } from "./collection-filters"
import { getWorkspaceDatasets, getWorkspaceSamples } from "./data.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export const dataPageLimit = 50

export type ProjectScope = "all" | "assigned" | "shared"

type ProjectFilters =
  | { projectMfid?: undefined; projectScope?: undefined }
  | { projectMfid: string; projectScope?: ProjectScope }

export type CursorFilters = ProjectFilters &
  CollectionFilters & {
    cursor?: string
    limit: number
  }

export type DatasetCursorFilters = CursorFilters & {
  instrumentMfid?: string
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
    projectMfid?: string
    projectScope?: ProjectScope
    visibility?: "all" | "public" | "private"
  },
  previousData: TData | undefined,
  previousQuery: { queryKey: readonly unknown[] } | undefined
) {
  const queryKey = previousQuery?.queryKey
  const previousFilters = queryKey?.[5]
  const previousInstrumentMfid =
    isRecord(previousFilters) &&
    typeof previousFilters.instrumentMfid === "string"
      ? previousFilters.instrumentMfid
      : undefined
  const previousProjectMfid =
    isRecord(previousFilters) && typeof previousFilters.projectMfid === "string"
      ? previousFilters.projectMfid
      : undefined
  const previousProjectScope =
    isRecord(previousFilters) &&
    typeof previousFilters.projectScope === "string"
      ? previousFilters.projectScope
      : undefined
  const previousVisibility =
    isRecord(previousFilters) && typeof previousFilters.visibility === "string"
      ? previousFilters.visibility
      : undefined
  const previousCreatedFrom =
    isRecord(previousFilters) && typeof previousFilters.createdFrom === "string"
      ? previousFilters.createdFrom
      : undefined
  const previousCreatedTo =
    isRecord(previousFilters) && typeof previousFilters.createdTo === "string"
      ? previousFilters.createdTo
      : undefined

  return queryKey?.[0] === scope[0] &&
    queryKey[1] === scope[1] &&
    queryKey[2] === scope[2] &&
    queryKey[3] === family &&
    queryKey[4] === "list" &&
    previousInstrumentMfid === filters.instrumentMfid &&
    previousProjectMfid === filters.projectMfid &&
    previousProjectScope === filters.projectScope &&
    previousVisibility === filters.visibility &&
    previousCreatedFrom === filters.createdFrom &&
    previousCreatedTo === filters.createdTo
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
  collectionFilters: CollectionFilters = {}
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
  return projectMfid
    ? { projectMfid, projectScope: filters.projectScope ?? "all" }
    : {}
}

export function samplesQueryOptions(
  scope: IdentityScope,
  filters: CursorFilters
) {
  const scenario = fixtureScenarioFromScope(scope)
  const projectFilters = normalizeProjectFilters(filters)
  const collectionFilters = normalizeCollectionFilters(filters)
  return queryOptions({
    queryKey: crucibleKeys.samples(scope, {
      cursor: filters.cursor ?? null,
      limit: filters.limit,
      ...projectFilters,
      ...collectionFilters,
    }),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceSamples({
          data: {
            cursor: filters.cursor,
            limit: filters.limit,
            ...projectFilters,
            ...collectionFilters,
            scenario,
          },
          signal,
        })
      ),
    placeholderData: (previousData, previousQuery) =>
      collectionScopedPreviousData(
        scope,
        "samples",
        { ...projectFilters, ...collectionFilters },
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
  const pageFilters: CursorFilters = {
    cursor: filters.cursor,
    limit: filters.limit,
  }
  const keyFilters = {
    cursor: pageFilters.cursor ?? null,
    limit: pageFilters.limit,
    ...(instrumentMfid ? { instrumentMfid } : {}),
    ...projectFilters,
    ...collectionFilters,
  }
  return queryOptions({
    queryKey: crucibleKeys.datasets(scope, keyFilters),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceDatasets({
          data: {
            ...pageFilters,
            ...(instrumentMfid ? { instrumentMfid } : {}),
            ...projectFilters,
            ...collectionFilters,
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
        collectionFilters
      ),
    retry: scenario ? false : undefined,
  })
}
