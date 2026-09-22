import { infiniteQueryOptions } from "@tanstack/react-query"

import type {
  WorkspaceDeletionAuditFilters,
  WorkspaceDeletionRequestFilters,
} from "./deletion-requests.server"
import {
  getWorkspaceDeletionAudit,
  getWorkspaceDeletionRequests,
} from "./deletion-requests.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

export const deletionRequestPageLimit = 50

export function deletionAuditInfiniteQueryOptions(scope: IdentityScope) {
  const scenario = fixtureScenarioFromScope(scope)
  const filters: WorkspaceDeletionAuditFilters = {
    limit: deletionRequestPageLimit,
    offset: 0,
  }
  return infiniteQueryOptions({
    initialPageParam: 0,
    queryKey: crucibleKeys.deletionAudit(scope, filters),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceDeletionAudit({
          data: { ...filters, offset: pageParam, scenario },
          signal,
        })
      ),
    getNextPageParam: (page) => {
      const nextOffset = page.offset + page.items.length
      if (page.items.length < page.limit) return undefined
      if (page.total !== null && nextOffset >= page.total) return undefined
      return nextOffset
    },
    retry: scenario ? false : undefined,
  })
}

export function deletionRequestsInfiniteQueryOptions(
  scope: IdentityScope,
  filters: Omit<WorkspaceDeletionRequestFilters, "cursor">
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
            scenario,
          },
          signal,
        })
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: scenario ? false : undefined,
  })
}
