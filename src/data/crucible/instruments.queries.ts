import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"

import {
  getWorkspaceInstrumentOperators,
  getWorkspaceInstruments,
} from "./instruments.functions"
import type { CollectionAffiliation } from "./collection-query"
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
  affiliation: CollectionAffiliation | undefined,
  direction: WorkspaceSortDirection | undefined,
  includeOwner: boolean,
  includeTotal: boolean,
  sort: WorkspaceInstrumentSort | undefined,
  status: WorkspaceInstrumentStatus,
  previousData: TData | undefined,
  previousQuery: { queryKey: readonly unknown[] } | undefined
) {
  if (
    collectionScopedPreviousData(
      scope,
      { affiliation, direction, includeOwner, includeTotal, sort, status },
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
    affiliation?: CollectionAffiliation
    cursor?: string
    direction?: WorkspaceSortDirection
    includeOwner?: boolean
    includeTotal?: boolean
    limit: number
    sort?: WorkspaceInstrumentSort
    status: WorkspaceInstrumentStatus
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
        filters.affiliation,
        filters.direction,
        filters.includeOwner ?? true,
        filters.includeTotal ?? true,
        filters.sort,
        filters.status,
        previousData,
        previousQuery
      ),
    retry: scenario ? false : undefined,
  })
}

export function instrumentsCursorQueryOptions(
  scope: IdentityScope,
  filters: {
    affiliation?: CollectionAffiliation
    cursor?: string
    direction?: WorkspaceSortDirection
    includeOwner?: boolean
    includeTotal?: boolean
    limit: number
    sort?: WorkspaceInstrumentSort
    status: WorkspaceInstrumentStatus
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
      limit: filters.limit,
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
            limit: filters.limit,
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
        filters.affiliation,
        filters.direction,
        filters.includeOwner ?? true,
        filters.includeTotal ?? true,
        filters.sort,
        filters.status,
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
