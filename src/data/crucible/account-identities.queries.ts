import { queryOptions } from "@tanstack/react-query"

import {
  getPendingWorkspaceAccountLink,
  getWorkspaceAccountIdentities,
} from "./account-identities.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"
import { getHubSignInOptions } from "./session.functions"

export function accountIdentitiesQueryOptions(scope: IdentityScope) {
  return queryOptions({
    queryKey: crucibleKeys.accountIdentities(scope),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceAccountIdentities({
          data: { scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
  })
}

export function accountPendingLinkQueryOptions(scope: IdentityScope) {
  return queryOptions({
    queryKey: crucibleKeys.accountPendingLink(scope),
    queryFn: async ({ signal }) =>
      unwrapHubResult(await getPendingWorkspaceAccountLink({ signal })),
    retry: false,
    staleTime: Infinity,
  })
}

export function signInMethodsQueryOptions(scope: IdentityScope) {
  return queryOptions({
    queryKey: crucibleKeys.signInMethods(scope),
    queryFn: async () => (await getHubSignInOptions()).methods,
    staleTime: 5 * 60 * 1000,
  })
}
