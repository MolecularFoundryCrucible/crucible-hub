import { queryOptions } from "@tanstack/react-query"

import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { getWorkspace } from "./workspace.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { workspaceContent } from "./workspace-source"

export function workspaceQueryOptions(scope: IdentityScope) {
  return queryOptions({
    queryKey: crucibleKeys.workspace(scope),
    queryFn: async ({ signal }) => {
      const source = await getWorkspace({
        data: { scenario: fixtureScenarioFromScope(scope) },
        signal,
      })

      if (source.status === "unavailable") throw new Error(source.reason)
      if (source.workspace.account.unique_id !== scope[2]) {
        throw new Error("The active Crucible account changed.")
      }

      return workspaceContent(source.workspace)
    },
  })
}
