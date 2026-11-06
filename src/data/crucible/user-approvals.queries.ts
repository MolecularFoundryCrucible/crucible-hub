import { queryOptions } from "@tanstack/react-query"

import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"
import { getWorkspacePendingUsers } from "./user-approvals.functions"

export function pendingUsersQueryOptions(scope: IdentityScope) {
  return queryOptions({
    queryKey: crucibleKeys.pendingUsers(scope),
    queryFn: async ({ signal }) =>
      unwrapHubResult(await getWorkspacePendingUsers({ signal })),
    staleTime: 30 * 1000,
  })
}
