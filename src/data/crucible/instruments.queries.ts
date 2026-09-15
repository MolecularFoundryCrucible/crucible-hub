import { queryOptions } from "@tanstack/react-query"

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
import type { WorkspaceInstrumentStatus } from "./workspace-source"

export const instrumentPageLimit = 20

function instrumentStatusScopedPreviousData<TData>(
  scope: IdentityScope,
  affiliation: CollectionAffiliation | undefined,
  status: WorkspaceInstrumentStatus,
  includeOwner: boolean,
  includeTotal: boolean,
  previousData: TData | undefined,
  previousQuery: { queryKey: readonly unknown[] } | undefined
) {
  if (
    collectionScopedPreviousData(
      scope,
      { affiliation, includeOwner, includeTotal, status },
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
    includeOwner?: boolean
    includeTotal?: boolean
    limit: number
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
        filters.status,
        filters.includeOwner ?? true,
        filters.includeTotal ?? true,
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
