import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { getWorkspacePrinters } from "./print.functions"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export function printersQueryOptions(scope: IdentityScope) {
  return queryOptions({
    queryKey: crucibleKeys.printers(scope),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspacePrinters({
          data: { scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
    staleTime: 0,
    gcTime: 60_000,
  })
}
