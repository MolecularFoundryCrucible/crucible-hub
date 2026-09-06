import { queryOptions } from "@tanstack/react-query"

import { getWorkspaceInstruments } from "./instruments.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { identityScopedPreviousData } from "./pagination"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export const instrumentPageLimit = 20

export function instrumentsQueryOptions(
  scope: IdentityScope,
  filters: { limit: number; offset: number }
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
