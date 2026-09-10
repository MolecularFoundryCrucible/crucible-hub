import { queryOptions } from "@tanstack/react-query"

import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import {
  getWorkspaceDatasetFiles,
  getWorkspaceDatasetIngestionRequests,
  getWorkspaceDatasetThumbnailPreviews,
  getWorkspaceDatasetThumbnails,
  getWorkspaceIngestionClasses,
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

export function datasetIngestionRequestsQueryOptions(
  scope: IdentityScope,
  datasetMfid: string
) {
  return queryOptions({
    queryKey: crucibleKeys.datasetIngestionRequests(scope, datasetMfid),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceDatasetIngestionRequests({
          data: { datasetMfid, scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
  })
}

export function ingestionClassesQueryOptions(scope: IdentityScope) {
  return queryOptions({
    queryKey: crucibleKeys.ingestionClasses(scope),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceIngestionClasses({
          data: { scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
    staleTime: 5 * 60 * 1000,
  })
}

export function datasetThumbnailsQueryOptions(
  scope: IdentityScope,
  datasetMfid: string
) {
  return queryOptions({
    queryKey: crucibleKeys.datasetThumbnails(scope, datasetMfid),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceDatasetThumbnails({
          data: { datasetMfid, scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
  })
}

export function datasetThumbnailPreviewsQueryOptions(
  scope: IdentityScope,
  datasetMfids: readonly string[]
) {
  return queryOptions({
    queryKey: crucibleKeys.datasetThumbnailPreviews(scope, datasetMfids),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceDatasetThumbnailPreviews({
          data: {
            datasetMfids: [...datasetMfids],
            scenario: fixtureScenarioFromScope(scope),
          },
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
