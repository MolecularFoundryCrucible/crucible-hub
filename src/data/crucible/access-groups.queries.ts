import { queryOptions } from "@tanstack/react-query"

import {
  getWorkspaceAccessGroup,
  getWorkspaceAccessGroups,
  getWorkspaceAccessGroupUsers,
} from "./access-groups.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export function accessGroupsListQueryOptions(scope: IdentityScope) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.accessGroupAdminList(scope),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceAccessGroups({
          data: { scenario },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}

export function accessGroupDetailQueryOptions(
  scope: IdentityScope,
  groupName: string
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.accessGroupAdminDetail(scope, groupName),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceAccessGroup({
          data: { groupName, scenario },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}

export function accessGroupUsersQueryOptions(
  scope: IdentityScope,
  groupName: string
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.accessGroupAdminUsers(scope, groupName),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceAccessGroupUsers({
          data: { groupName, scenario },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}
