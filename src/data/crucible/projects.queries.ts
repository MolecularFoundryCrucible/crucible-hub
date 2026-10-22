import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"

import type { OwnershipAffiliation } from "./collection-query"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys, privilegeModeFromScope } from "./query-keys"
import {
  getWorkspaceProject,
  getWorkspaceProjects,
  getWorkspaceUserProjects,
} from "./projects.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { identityScopedPreviousData } from "./pagination"
import { unwrapHubResult } from "./result"
import type {
  WorkspaceProject,
  WorkspaceProjectSort,
  WorkspaceSortDirection,
  WorkspaceAccessPermission,
} from "./workspace-source"

export const projectPageLimit = 100

export function userProjectsQueryOptions(
  scope: IdentityScope,
  userRef: string,
  filters: {
    direction?: WorkspaceSortDirection
    limit: number
    sort?: WorkspaceProjectSort
  }
) {
  return queryOptions({
    queryKey: crucibleKeys.userProjects(scope, userRef, filters),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceUserProjects({
          data: {
            ...filters,
            privilegeMode: privilegeModeFromScope(scope),
            scenario: fixtureScenarioFromScope(scope),
            userRef,
          },
          signal,
        })
      ),
    placeholderData: (previousData, previousQuery) =>
      identityScopedPreviousData(scope, previousData, previousQuery) !==
        undefined && previousQuery?.queryKey[6] === userRef
        ? previousData
        : undefined,
  })
}

export function projectsQueryOptions(
  scope: IdentityScope,
  filters: {
    activeSince?: string
    affiliation?: OwnershipAffiliation
    cursor?: string
    direction?: WorkspaceSortDirection
    includeTotal?: boolean
    limit: number
    memberRef?: string | readonly string[]
    memberRole?:
      WorkspaceAccessPermission | readonly WorkspaceAccessPermission[]
    sort?: WorkspaceProjectSort
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
          data: {
            ...filters,
            memberRef:
              typeof filters.memberRef === "string"
                ? filters.memberRef
                : filters.memberRef
                  ? [...filters.memberRef]
                  : undefined,
            memberRole:
              typeof filters.memberRole === "string"
                ? filters.memberRole
                : filters.memberRole
                  ? [...filters.memberRole]
                  : undefined,
            privilegeMode: privilegeModeFromScope(scope),
            scenario: fixtureScenarioFromScope(scope),
          },
          signal,
        })
      ),
    placeholderData: (previousData, previousQuery) =>
      identityScopedPreviousData(scope, previousData, previousQuery),
  })
}

export function projectsCursorQueryOptions(
  scope: IdentityScope,
  filters: {
    activeSince?: string
    affiliation?: OwnershipAffiliation
    cursor?: string
    direction?: WorkspaceSortDirection
    includeTotal?: boolean
    limit: number
    memberRef?: string | readonly string[]
    memberRole?:
      WorkspaceAccessPermission | readonly WorkspaceAccessPermission[]
    sort?: WorkspaceProjectSort
  }
) {
  const scenario = fixtureScenarioFromScope(scope)
  return infiniteQueryOptions({
    initialPageParam: filters.cursor,
    queryKey: crucibleKeys.projectCursorChain(scope, {
      activeSince: filters.activeSince,
      affiliation: filters.affiliation,
      direction: filters.direction,
      includeTotal: filters.includeTotal ?? true,
      initialCursor: filters.cursor ?? null,
      limit: filters.limit,
      memberRef: filters.memberRef,
      memberRole: filters.memberRole,
      sort: filters.sort,
    }),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceProjects({
          data: {
            activeSince: filters.activeSince,
            affiliation: filters.affiliation,
            cursor: pageParam,
            direction: filters.direction,
            includeTotal: filters.includeTotal,
            limit: filters.limit,
            memberRef:
              typeof filters.memberRef === "string"
                ? filters.memberRef
                : filters.memberRef
                  ? [...filters.memberRef]
                  : undefined,
            memberRole:
              typeof filters.memberRole === "string"
                ? filters.memberRole
                : filters.memberRole
                  ? [...filters.memberRole]
                  : undefined,
            privilegeMode: privilegeModeFromScope(scope),
            scenario,
            sort: filters.sort,
          },
          signal,
        })
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    placeholderData: (previousData, previousQuery) =>
      identityScopedPreviousData(scope, previousData, previousQuery),
    retry: scenario ? false : undefined,
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
            privilegeMode: privilegeModeFromScope(scope),
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
      if (cachedDetail !== undefined) {
        return client.fetchQuery(projectQueryOptions(scope, projectMfid))
      }
      return unwrapHubResult(
        await getWorkspaceProject({
          data: {
            projection: "summary",
            privilegeMode: privilegeModeFromScope(scope),
            projectMfid,
            scenario: fixtureScenarioFromScope(scope),
          },
          signal,
        })
      )
    },
  })
}
