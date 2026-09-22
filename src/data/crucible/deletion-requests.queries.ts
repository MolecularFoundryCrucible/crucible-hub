import { infiniteQueryOptions } from "@tanstack/react-query"

import type { WorkspaceDeletionRequestFilters } from "./deletion-requests.server"
import { getWorkspaceDeletionRequests } from "./deletion-requests.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export const deletionRequestPageLimit = 50

export function deletionRequestsInfiniteQueryOptions(
  scope: IdentityScope,
  filters: Omit<WorkspaceDeletionRequestFilters, "cursor">
) {
  const scenario = fixtureScenarioFromScope(scope)
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: crucibleKeys.deletionRequests(scope, filters),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceDeletionRequests({
          data: {
            ...filters,
            cursor: pageParam ?? undefined,
            scenario,
          },
          signal,
        })
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: scenario ? false : undefined,
  })
}
