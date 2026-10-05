import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"
import {
  getWorkspaceUserAccessGroups,
  getWorkspaceUserApiKeyStatus,
  getWorkspaceUserDetail,
  getWorkspaceUserProjects,
  getWorkspaceUsers,
} from "./users.functions"

export const userAdminPageLimit = 50

export function usersListQueryOptions(
  scope: IdentityScope,
  filters: {
    is_service_account?: boolean
    limit: number
    offset: number
    query?: string
  }
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.userAdminList(scope, filters),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceUsers({
          data: { ...filters, scenario },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}

export function userDetailQueryOptions(scope: IdentityScope, userId: string) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.userAdminDetail(scope, userId),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceUserDetail({
          data: { scenario, userId },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}

export function userApiKeyStatusQueryOptions(
  scope: IdentityScope,
  userId: string
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.userAdminApiKeyStatus(scope, userId),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceUserApiKeyStatus({
          data: { scenario, userId },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}

export function userAccessGroupsQueryOptions(
  scope: IdentityScope,
  userId: string
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.userAdminAccessGroups(scope, userId),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceUserAccessGroups({
          data: { scenario, userId },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}

export function userProjectsQueryOptions(scope: IdentityScope, userId: string) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.userAdminProjects(scope, userId),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceUserProjects({
          data: { scenario, userId },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}
