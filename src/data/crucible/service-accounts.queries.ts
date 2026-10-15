import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"
import {
  getWorkspaceServiceAccountAdmin,
  getWorkspaceServiceAccounts,
} from "./service-accounts.functions"
import type { UserActivityFilter } from "./user-activity"
import type { WorkspaceServiceAccountSort } from "./workspace-source"

export const serviceAccountPageLimit = 50

export function serviceAccountsCursorQueryOptions(
  scope: IdentityScope,
  filters: {
    activity?: UserActivityFilter
    cursor?: string
    direction?: "asc" | "desc"
    includeTotal?: boolean
    limit: number
    query?: string
    sort?: WorkspaceServiceAccountSort
  }
) {
  const scenario = fixtureScenarioFromScope(scope)
  return infiniteQueryOptions({
    initialPageParam: filters.cursor,
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceServiceAccounts({
          data: {
            activity: filters.activity,
            cursor: pageParam,
            direction: filters.direction,
            includeTotal: filters.includeTotal,
            limit: filters.limit,
            query: filters.query,
            scenario,
            sort: filters.sort,
          },
          signal,
        })
      ),
    queryKey: crucibleKeys.serviceAccountCursorChain(scope, {
      activity: filters.activity,
      direction: filters.direction,
      includeTotal: filters.includeTotal ?? true,
      initialCursor: filters.cursor ?? null,
      limit: filters.limit,
      query: filters.query,
      sort: filters.sort,
    }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: scenario ? false : undefined,
  })
}

export function serviceAccountAdminQueryOptions(
  scope: IdentityScope,
  serviceAccountMfid: string
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.serviceAccountAdmin(scope, serviceAccountMfid),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceServiceAccountAdmin({
          data: { scenario, serviceAccountMfid },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}
