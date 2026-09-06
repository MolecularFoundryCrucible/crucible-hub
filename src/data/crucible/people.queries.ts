import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { getWorkspacePerson } from "./people.functions"
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
