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
      identityScopedPreviousData(scope, previousData, previousQuery),
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
