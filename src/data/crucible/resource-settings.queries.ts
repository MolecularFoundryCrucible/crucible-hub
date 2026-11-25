import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { crucibleKeys } from "./query-keys"
import type { IdentityScope } from "./query-keys"
import { getWorkspaceResourceSettings } from "./resource-settings.functions"
import { unwrapHubResult } from "./result"
import type { WorkspaceSettingsKind } from "./workspace-source"

export function resourceSettingsQueryOptions(
  scope: IdentityScope,
  kind: WorkspaceSettingsKind,
  mfid: string
) {
  return queryOptions({
    queryKey: crucibleKeys.resourceSettings(scope, mfid),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceResourceSettings({
          data: { kind, mfid, scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
  })
}
