import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"

import {
  getWorkspaceInstrumentOperators,
  getWorkspaceInstruments,
} from "./instruments.functions"
import type { InstrumentAffiliation } from "./collection-query"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { collectionScopedPreviousData } from "./pagination"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"
import type {
  WorkspaceInstrumentSort,
  WorkspaceInstrumentStatus,
  WorkspaceSortDirection,
} from "./workspace-source"

export const instrumentPageLimit = 100

function instrumentStatusScopedPreviousData<TData>(
  scope: IdentityScope,
  filters: {
    affiliation?: InstrumentAffiliation
    direction?: WorkspaceSortDirection
    includeOwner: boolean
    includeTotal: boolean
    instrumentType?: string
    location?: string
    manufacturer?: string
    ownerId?: string
    sort?: WorkspaceInstrumentSort
    status?: WorkspaceInstrumentStatus
  },
  previousData: TData | undefined,
  previousQuery: { queryKey: readonly unknown[] } | undefined
) {
  if (
    collectionScopedPreviousData(
      scope,
      filters,
      previousData,
      previousQuery
    ) === undefined
  ) {
    return undefined
  }
  return previousData
}

export function instrumentsQueryOptions(
  scope: IdentityScope,
  filters: {
    affiliation?: InstrumentAffiliation
    cursor?: string
    direction?: WorkspaceSortDirection
    includeOwner?: boolean
    includeTotal?: boolean
    instrumentType?: string
    limit: number
    location?: string
    manufacturer?: string
    ownerId?: string
    sort?: WorkspaceInstrumentSort
    status?: WorkspaceInstrumentStatus
  }
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.instruments(scope, {
      ...filters,
      includeOwner: filters.includeOwner ?? true,
      includeTotal: filters.includeTotal ?? true,
    }),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceInstruments({
          data: { ...filters, scenario },
          signal,
        })
      ),
    placeholderData: (previousData, previousQuery) =>
      instrumentStatusScopedPreviousData(
        scope,
        {
          affiliation: filters.affiliation,
          direction: filters.direction,
          includeOwner: filters.includeOwner ?? true,
          includeTotal: filters.includeTotal ?? true,
          instrumentType: filters.instrumentType,
          location: filters.location,
          manufacturer: filters.manufacturer,
          ownerId: filters.ownerId,
          sort: filters.sort,
          status: filters.status,
        },
        previousData,
        previousQuery
      ),
    retry: scenario ? false : undefined,
  })
}

export function instrumentsCursorQueryOptions(
  scope: IdentityScope,
  filters: {
    affiliation?: InstrumentAffiliation
    cursor?: string
    direction?: WorkspaceSortDirection
    includeOwner?: boolean
    includeTotal?: boolean
    instrumentType?: string
    limit: number
    location?: string
    manufacturer?: string
    ownerId?: string
    sort?: WorkspaceInstrumentSort
    status?: WorkspaceInstrumentStatus
  }
) {
  const scenario = fixtureScenarioFromScope(scope)
  return infiniteQueryOptions({
    initialPageParam: filters.cursor,
    queryKey: crucibleKeys.instrumentCursorChain(scope, {
      affiliation: filters.affiliation,
      direction: filters.direction,
      includeOwner: filters.includeOwner ?? true,
      includeTotal: filters.includeTotal ?? true,
      initialCursor: filters.cursor ?? null,
      instrumentType: filters.instrumentType,
      limit: filters.limit,
      location: filters.location,
      manufacturer: filters.manufacturer,
      ownerId: filters.ownerId,
      sort: filters.sort,
      status: filters.status,
    }),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceInstruments({
          data: {
            affiliation: filters.affiliation,
            cursor: pageParam,
            direction: filters.direction,
            includeOwner: filters.includeOwner,
            includeTotal: filters.includeTotal,
            instrumentType: filters.instrumentType,
            limit: filters.limit,
            location: filters.location,
            manufacturer: filters.manufacturer,
            ownerId: filters.ownerId,
            scenario,
            sort: filters.sort,
            status: filters.status,
          },
          signal,
        })
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    placeholderData: (previousData, previousQuery) =>
      instrumentStatusScopedPreviousData(
        scope,
        {
          affiliation: filters.affiliation,
          direction: filters.direction,
          includeOwner: filters.includeOwner ?? true,
          includeTotal: filters.includeTotal ?? true,
          instrumentType: filters.instrumentType,
          location: filters.location,
          manufacturer: filters.manufacturer,
          ownerId: filters.ownerId,
          sort: filters.sort,
          status: filters.status,
        },
        previousData,
        previousQuery
      ),
    retry: scenario ? false : undefined,
  })
}

export function instrumentOperatorsQueryOptions(
  scope: IdentityScope,
  instrumentMfid: string
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.instrumentOperators(scope, instrumentMfid),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceInstrumentOperators({
          data: { instrumentMfid, scenario },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}
