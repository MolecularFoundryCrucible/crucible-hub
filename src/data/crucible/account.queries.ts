import { queryOptions } from "@tanstack/react-query"

import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { getWorkspaceAccount } from "./account.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { unwrapHubResult } from "./result"

export function accountQueryOptions(scope: IdentityScope) {
  return queryOptions({
    queryKey: crucibleKeys.accountProfile(scope),
    queryFn: async ({ signal }) => {
      const account = unwrapHubResult(
        await getWorkspaceAccount({
          data: { scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      )
      if (account.unique_id !== scope[2]) {
        throw new Error("The active Crucible account changed.")
      }
      return account
    },
  })
}
