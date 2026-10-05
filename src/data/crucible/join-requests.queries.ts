import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import {
  getWorkspaceJoinRequest,
  getWorkspaceJoinRequests,
} from "./join-requests.functions"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export const joinRequestAdminPageLimit = 50

export function joinRequestsListQueryOptions(
  scope: IdentityScope,
  filters: {
    group_name?: string
    limit: number
    offset: number
    requester_id?: string
    status?: string
  }
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.joinRequestAdminList(scope, filters),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceJoinRequests({
          data: { ...filters, scenario },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}

export function joinRequestDetailQueryOptions(
  scope: IdentityScope,
  requestId: number
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.joinRequestAdminDetail(scope, requestId),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceJoinRequest({
          data: { requestId, scenario },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}
