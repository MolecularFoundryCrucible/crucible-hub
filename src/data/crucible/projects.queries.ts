import { queryOptions } from "@tanstack/react-query"

import type { CollectionAffiliation } from "./collection-query"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { getWorkspaceProject, getWorkspaceProjects } from "./projects.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { collectionScopedPreviousData } from "./pagination"
import { unwrapHubResult } from "./result"
import type { WorkspaceProject } from "./workspace-source"

export const projectPageLimit = 20

export function projectsQueryOptions(
  scope: IdentityScope,
  filters: {
    affiliation?: CollectionAffiliation
    cursor?: string
    includeTotal?: boolean
    limit: number
  }
) {
  return queryOptions({
    queryKey: crucibleKeys.projects(scope, {
      ...filters,
      includeTotal: filters.includeTotal ?? true,
    }),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceProjects({
          data: { ...filters, scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
    placeholderData: (previousData, previousQuery) =>
      collectionScopedPreviousData(
        scope,
        {
          affiliation: filters.affiliation,
          includeTotal: filters.includeTotal ?? true,
        },
        previousData,
        previousQuery
      ),
  })
}

export function projectQueryOptions(scope: IdentityScope, projectMfid: string) {
  return queryOptions({
    queryKey: crucibleKeys.project(scope, projectMfid),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceProject({
          data: {
            projection: "overview",
            projectMfid,
            scenario: fixtureScenarioFromScope(scope),
          },
          signal,
        })
      ),
  })
}

export function projectSummaryQueryOptions(
  scope: IdentityScope,
  projectMfid: string
) {
  return queryOptions({
    queryKey: crucibleKeys.projectSummary(scope, projectMfid),
    queryFn: async ({ client, signal }) => {
      const cachedDetail = client.getQueryData<WorkspaceProject | null>(
        crucibleKeys.project(scope, projectMfid)
      )
      if (cachedDetail !== undefined) return cachedDetail
      return unwrapHubResult(
        await getWorkspaceProject({
          data: {
            projection: "summary",
            projectMfid,
            scenario: fixtureScenarioFromScope(scope),
          },
          signal,
        })
      )
    },
  })
}
