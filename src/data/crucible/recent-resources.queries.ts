import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { recentResourceLimit } from "./recent-resources"
import { getRecentResources } from "./recent-resources.functions"
import { unwrapHubResult } from "./result"

export function recentResourcesQueryOptions(scope: IdentityScope) {
  return queryOptions({
    queryKey: crucibleKeys.recentResources(scope),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getRecentResources({
          data: {
            limit: recentResourceLimit,
            scenario: fixtureScenarioFromScope(scope),
          },
          signal,
        })
      ),
    staleTime: 60 * 1000,
  })
}
