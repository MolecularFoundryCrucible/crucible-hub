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
            privilegeMode: scope[3],
            scenario,
          },
          signal,
        })
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: scenario ? false : undefined,
  })
}
