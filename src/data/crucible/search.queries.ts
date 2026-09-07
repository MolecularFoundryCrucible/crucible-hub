import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { identityScopedPreviousData } from "./pagination"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { getWorkspaceSearch } from "./search.functions"
import { unwrapHubResult } from "./result"
import type { WorkspaceSearchKind } from "./workspace-source"

export const searchGroupLimit = 8

export function searchQueryOptions(
  scope: IdentityScope,
  query: string,
  kinds: readonly WorkspaceSearchKind[],
  projectMfid?: string
) {
  const normalizedKinds = [...kinds].sort()
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.search(scope, {
      kinds: normalizedKinds,
      limit: searchGroupLimit,
      projectMfid: projectMfid ?? null,
      query,
    }),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceSearch({
          data: {
            kinds: [...kinds],
            limit: searchGroupLimit,
            projectMfid,
            query,
            scenario,
          },
          signal,
        })
      ),
    placeholderData: (previousData, previousQuery) =>
      identityScopedPreviousData(scope, previousData, previousQuery),
    retry: scenario ? false : undefined,
  })
}
