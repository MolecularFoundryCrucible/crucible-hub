import { queryOptions } from "@tanstack/react-query"

import type { WorkspaceDeletionRequestFilters } from "./deletion-requests.server"
import { getWorkspaceDeletionRequests } from "./deletion-requests.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export const deletionRequestPageLimit = 50

export function deletionRequestsQueryOptions(
  scope: IdentityScope,
  filters: WorkspaceDeletionRequestFilters
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.deletionRequests(scope, filters),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceDeletionRequests({
          data: { ...filters, scenario },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}
