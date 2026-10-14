import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { getAccountPreferences } from "./preferences.functions"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export function accountPreferencesQueryOptions(scope: IdentityScope) {
  return queryOptions({
    queryKey: crucibleKeys.accountPreferences(scope),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getAccountPreferences({
          data: { scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
    staleTime: 5 * 60 * 1000,
  })
}
