import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import {
  getWorkspacePerson,
  getWorkspaceServiceAccount,
} from "./people.functions"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export function personQueryOptions(scope: IdentityScope, personId: string) {
  return queryOptions({
    queryKey: crucibleKeys.person(scope, personId),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspacePerson({
          data: { personId, scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
  })
}

export function lookupServiceAccountQueryOptions(
  scope: IdentityScope,
  reference: string
) {
  return queryOptions({
    queryKey: crucibleKeys.serviceAccount(scope, reference),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceServiceAccount({
          data: { reference, scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
  })
}
