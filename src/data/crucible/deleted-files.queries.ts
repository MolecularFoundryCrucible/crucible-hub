import { queryOptions } from "@tanstack/react-query"

import { getWorkspaceDeletedFiles } from "./deleted-files.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { crucibleKeys, privilegeModeFromScope } from "./query-keys"
import type { IdentityScope } from "./query-keys"
import { unwrapHubResult } from "./result"

export function deletedFilesQueryOptions(
  scope: IdentityScope,
  datasetMfid: string
) {
  return queryOptions({
    queryKey: crucibleKeys.datasetDeletedFiles(scope, datasetMfid),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceDeletedFiles({
          data: {
            datasetMfid,
            privilegeMode: privilegeModeFromScope(scope),
            scenario: fixtureScenarioFromScope(scope),
          },
          signal,
        })
      ),
  })
}
