import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"
import { getWorkspaceWorkers } from "./workers.functions"

export function workersQueryOptions(scope: IdentityScope) {
  return queryOptions({
    queryKey: crucibleKeys.workers(scope),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceWorkers({
          data: { scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
  })
}
