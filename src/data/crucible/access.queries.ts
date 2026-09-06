import { queryOptions } from "@tanstack/react-query"

import { getWorkspaceResourceAccess } from "./access.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export function resourceAccessQueryOptions(
  scope: IdentityScope,
  resourceMfid: string
) {
  return queryOptions({
    queryKey: crucibleKeys.resourceAccess(scope, resourceMfid),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceResourceAccess({
          data: { resourceMfid, scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
  })
}
