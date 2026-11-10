import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { getJoinRequests } from "./join-requests.functions"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys, privilegeModeFromScope } from "./query-keys"
import { unwrapHubResult } from "./result"
import type { WorkspaceJoinRequestStatus } from "./workspace-source"

export type JoinRequestFilters = {
  limit?: number
  projectMfid?: string
  scope: "reviewable" | "submitted"
  status?: WorkspaceJoinRequestStatus
}

export function joinRequestsQueryOptions(
  scope: IdentityScope,
  filters: JoinRequestFilters
) {
  const scenario = fixtureScenarioFromScope(scope)
  const limit = filters.limit ?? 50
  return queryOptions({
    queryKey: crucibleKeys.joinRequests(scope, { ...filters, limit }),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getJoinRequests({
          data: {
            limit,
            privilegeMode: privilegeModeFromScope(scope),
            projectMfid: filters.projectMfid,
            scenario,
            scope: filters.scope,
            status: filters.status,
          },
          signal,
        })
      ),
    ...(scenario ? { retry: false } : {}),
  })
}

export function pendingJoinRequestsCountQueryOptions(scope: IdentityScope) {
  return queryOptions({
    ...joinRequestsQueryOptions(scope, {
      limit: 1,
      scope: "reviewable",
      status: "pending",
    }),
    select: (page) => page.total ?? page.items.length,
  })
}
