import { queryOptions } from "@tanstack/react-query"

import type { CollectionAffiliation } from "./collection-query"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { getWorkspaceProject, getWorkspaceProjects } from "./projects.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { collectionScopedPreviousData } from "./pagination"
import { unwrapHubResult } from "./result"

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
          data: { projectMfid, scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
  })
}
