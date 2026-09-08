import { queryOptions } from "@tanstack/react-query"

import {
  getWorkspaceInstrumentOperators,
  getWorkspaceInstruments,
} from "./instruments.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { identityScopedPreviousData } from "./pagination"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"
import type { WorkspaceInstrumentStatus } from "./workspace-source"

export const instrumentPageLimit = 20

function instrumentStatusScopedPreviousData<TData>(
  scope: IdentityScope,
  status: WorkspaceInstrumentStatus,
  previousData: TData | undefined,
  previousQuery: { queryKey: readonly unknown[] } | undefined
) {
  if (
    identityScopedPreviousData(scope, previousData, previousQuery) === undefined
  ) {
    return undefined
  }
  const previousFilters = previousQuery?.queryKey[5]
  return typeof previousFilters === "object" &&
    previousFilters !== null &&
    "status" in previousFilters &&
    previousFilters.status === status
    ? previousData
    : undefined
}

export function instrumentsQueryOptions(
  scope: IdentityScope,
  filters: {
    limit: number
    offset: number
    status: WorkspaceInstrumentStatus
  }
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.instruments(scope, filters),
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
