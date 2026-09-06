import { queryOptions } from "@tanstack/react-query"

import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { getWorkspaceProject, getWorkspaceProjects } from "./projects.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { identityScopedPreviousData } from "./pagination"
import { unwrapHubResult } from "./result"

export const projectPageLimit = 20

export function projectsQueryOptions(
  scope: IdentityScope,
  filters: { limit: number; offset: number }
) {
  return queryOptions({
    queryKey: crucibleKeys.projects(scope, filters),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceProjects({
          data: { ...filters, scenario: fixtureScenarioFromScope(scope) },
          signal,
        })
      ),
    placeholderData: (previousData, previousQuery) =>
      identityScopedPreviousData(scope, previousData, previousQuery),
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
