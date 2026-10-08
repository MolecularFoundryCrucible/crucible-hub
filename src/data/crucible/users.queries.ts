import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"
import { getWorkspaceUserDetail, getWorkspaceUsers } from "./users.functions"

export const userAdminPageLimit = 50

export function usersCursorQueryOptions(
  scope: IdentityScope,
  filters: {
    cursor?: string
    direction?: "asc" | "desc"
    includeTotal?: boolean
    is_service_account?: boolean
    limit: number
    query?: string
    sort?: "name" | "unique_id" | "email" | "username"
  }
) {
  const scenario = fixtureScenarioFromScope(scope)
  return infiniteQueryOptions({
    initialPageParam: filters.cursor,
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceUsers({
          data: {
            cursor: pageParam,
            direction: filters.direction,
            includeTotal: filters.includeTotal,
            is_service_account: filters.is_service_account,
            limit: filters.limit,
            query: filters.query,
            scenario,
            sort: filters.sort,
          },
          signal,
        })
      ),
    queryKey: crucibleKeys.userAdminCursorChain(scope, {
      direction: filters.direction,
      includeTotal: filters.includeTotal ?? true,
      initialCursor: filters.cursor ?? null,
      is_service_account: filters.is_service_account,
      limit: filters.limit,
      query: filters.query,
      sort: filters.sort,
    }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
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
