import { queryOptions } from "@tanstack/react-query"

import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import {
  getWorkspaceDatasetFiles,
  getWorkspaceResource,
  getWorkspaceResourceGraph,
} from "./resources.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { unwrapHubResult } from "./result"

export const resourceDetailShape = "overview-with-metadata-links-owner"

export function resourceQueryOptions(
  scope: IdentityScope,
  resourceMfid: string
) {
  return queryOptions({
    queryKey: crucibleKeys.resource(scope, resourceMfid, resourceDetailShape),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceResource({
          data: { resourceMfid, scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
  })
}

export function datasetFilesQueryOptions(
  scope: IdentityScope,
  datasetMfid: string
) {
  return queryOptions({
    queryKey: crucibleKeys.datasetFiles(scope, datasetMfid),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceDatasetFiles({
          data: { datasetMfid, scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
  })
}

export function resourceGraphQueryOptions(
  scope: IdentityScope,
  resourceMfid: string
) {
  return queryOptions({
    queryKey: crucibleKeys.resourceGraph(scope, resourceMfid),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceResourceGraph({
          data: { resourceMfid, scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
  })
}
