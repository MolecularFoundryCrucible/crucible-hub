import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"

import type {
  WorkspaceDeletionAuditFilters,
  WorkspaceDeletionRequestFilters,
} from "./deletion-requests.server"
import {
  getWorkspaceDeletionAudit,
  getWorkspaceDeletionRequests,
} from "./deletion-requests.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import { identityScopedPreviousData } from "./pagination"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys, privilegeModeFromScope } from "./query-keys"
import { unwrapHubResult } from "./result"

export const deletionRequestPageLimit = 50

export function deletionAuditInfiniteQueryOptions(
  scope: IdentityScope,
  auditScope: WorkspaceDeletionAuditFilters["scope"]
) {
  const scenario = fixtureScenarioFromScope(scope)
  const filters: WorkspaceDeletionAuditFilters = {
    direction: "desc",
    limit: deletionRequestPageLimit,
    scope: auditScope,
  }
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: crucibleKeys.deletionAudit(scope, filters),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceDeletionAudit({
          data: {
            ...filters,
            cursor: pageParam ?? undefined,
            scenario,
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

export function deletionRequestsInfiniteQueryOptions(
  scope: IdentityScope,
  filters: Omit<WorkspaceDeletionRequestFilters, "cursor" | "privilegeMode">
) {
  const scenario = fixtureScenarioFromScope(scope)
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: crucibleKeys.deletionRequests(scope, filters),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceDeletionRequests({
          data: {
            ...filters,
            cursor: pageParam ?? undefined,
            privilegeMode: privilegeModeFromScope(scope),
            scenario,
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

export function pendingDeletionRequestsCountQueryOptions(scope: IdentityScope) {
  const scenario = fixtureScenarioFromScope(scope)
  const filters = {
    direction: "desc" as const,
    limit: 1,
    scope: "reviewable" as const,
    sort: "request_time" as const,
    status: "pending" as const,
  }
  return queryOptions({
    queryKey: [
      ...crucibleKeys.deletionRequests(scope, filters),
      "pending-count",
    ] as const,
    queryFn: async ({ signal }) => {
      const result = unwrapHubResult(
        await getWorkspaceDeletionRequests({
          data: {
            ...filters,
            privilegeMode: privilegeModeFromScope(scope),
            scenario,
          },
          signal,
        })
      )
      return result.total ?? (result.items.length > 0 ? result.items.length : 0)
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: scenario ? false : undefined,
  })
}
