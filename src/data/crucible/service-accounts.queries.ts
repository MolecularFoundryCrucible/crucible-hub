import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"
import {
  getWorkspaceServiceAccountAdmin,
  getWorkspaceServiceAccounts,
} from "./service-accounts.functions"

export const serviceAccountPageLimit = 50

export function serviceAccountsQueryOptions(
  scope: IdentityScope,
  filters: { limit: number; offset: number; query?: string }
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.serviceAccounts(scope, filters),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceServiceAccounts({
          data: { ...filters, scenario },
          signal,
        })
      ),
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
