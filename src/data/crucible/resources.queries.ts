import { queryOptions } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"

import type { IdentityScope } from "./query-keys"
import { crucibleKeys, privilegeModeFromScope } from "./query-keys"
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
import type {
  WorkspaceResourceDetail,
  WorkspaceResourceGraphRequest,
} from "./workspace-source"

export const resourceDetailShape = "overview-with-metadata-links-owner"
export const resourceSummaryShape = "summary-with-owner"

export function resourceQueryOptions(
  scope: IdentityScope,
  resourceMfid: string
) {
  return queryOptions({
    queryKey: crucibleKeys.resource(scope, resourceMfid, resourceDetailShape),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceResource({
          data: {
            projection: "overview",
            privilegeMode: privilegeModeFromScope(scope),
            resourceMfid,
            scenario: fixtureScenarioFromScope(scope),
          },
          signal,
        })
      ),
  })
}

export function preloadResourceDetail(
  queryClient: QueryClient,
  scope: IdentityScope,
  resourceMfid: string
) {
  return queryClient.ensureQueryData(resourceQueryOptions(scope, resourceMfid))
}

export function isResourceOverviewPath(pathname: string, resourceMfid: string) {
  return pathname.replace(/\/+$/, "").endsWith(`/${resourceMfid}`)
}

export async function preloadResourceShell(
  queryClient: QueryClient,
  scope: IdentityScope,
  resourceMfid: string,
  forceApiResolution = false,
  includeDetail = false
) {
  const options = resourceSummaryQueryOptions(scope, resourceMfid)
  if (forceApiResolution) {
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: options.queryKey,
      refetchType: "none",
    })
    return queryClient.fetchQuery(options)
  }
  if (includeDetail)
    await preloadResourceDetail(queryClient, scope, resourceMfid)
  return queryClient.ensureQueryData(options)
}

export function resourceSummaryQueryOptions(
  scope: IdentityScope,
  resourceMfid: string
) {
  return queryOptions({
    queryKey: crucibleKeys.resource(scope, resourceMfid, resourceSummaryShape),
    queryFn: async ({ client, signal }) => {
      const cachedDetail = client.getQueryData<WorkspaceResourceDetail | null>(
        crucibleKeys.resource(scope, resourceMfid, resourceDetailShape)
      )
      if (cachedDetail !== undefined) {
        return client.fetchQuery(resourceQueryOptions(scope, resourceMfid))
      }
      return unwrapHubResult(
        await getWorkspaceResource({
          data: {
            projection: "summary",
            privilegeMode: privilegeModeFromScope(scope),
            resourceMfid,
            scenario: fixtureScenarioFromScope(scope),
          },
          signal,
        })
      )
    },
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
  resourceMfid: string,
  request: WorkspaceResourceGraphRequest = {}
) {
  const normalizedRequest = {
    depth: request.depth ?? 1,
    direction: request.direction ?? "both",
    relationshipKinds: request.relationshipKinds?.length
      ? [...new Set(request.relationshipKinds)].sort()
      : undefined,
    relationshipTypes: request.relationshipTypes?.length
      ? [...new Set(request.relationshipTypes)].sort()
      : undefined,
  } satisfies WorkspaceResourceGraphRequest
  return queryOptions({
    queryKey: crucibleKeys.resourceGraph(scope, resourceMfid, {
      depth: normalizedRequest.depth,
      direction: normalizedRequest.direction,
      relationshipKinds: normalizedRequest.relationshipKinds,
      relationshipTypes: normalizedRequest.relationshipTypes,
    }),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceResourceGraph({
          data: {
            ...normalizedRequest,
            resourceMfid,
            scenario: fixtureScenarioFromScope(scope),
          },
          signal,
        })
      ),
  })
}
