import { createFileRoute } from "@tanstack/react-router"
import { canOpenServiceAccountAdministration } from "@/data/crucible/administration"
import {
  crucibleKeys,
  identityScopeWithPrivilegeMode,
} from "@/data/crucible/query-keys"
import {
  serviceAccountPageLimit,
  serviceAccountsCursorQueryOptions,
} from "@/data/crucible/service-accounts.queries"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import {
  ServiceAccountsPending,
  ServiceAccountsPage,
} from "@/features/service-accounts/service-accounts-page"
import {
  apiServiceAccountSort,
  serviceAccountSearchSchema,
} from "@/features/service-accounts/service-accounts-search"

export const Route = createFileRoute("/_app/admin/service-accounts/")({
  head: () => ({ meta: [{ title: "Service accounts | Crucible Hub" }] }),
  validateSearch: serviceAccountSearchSchema,
  loaderDeps: ({ search }) => ({
    activity: search.activity,
    cursor: search.cursor,
    direction: search.direction,
    query: search.q,
    sort: search.sort,
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const account = context.queryClient.getQueryData<WorkspaceAccount>(
      crucibleKeys.accountProfile(source.scope)
    )
    if (
      !account ||
      !canOpenServiceAccountAdministration(account, source.privilegeMode)
    )
      return
    const administrationScope = identityScopeWithPrivilegeMode(
      source.scope,
      "elevated"
    )
    const options = serviceAccountsCursorQueryOptions(administrationScope, {
      activity: deps.activity,
      cursor: deps.cursor,
      direction: deps.direction,
      includeTotal: true,
      limit: serviceAccountPageLimit,
      query: deps.query,
      sort: apiServiceAccountSort(deps.sort),
    })
    const request = prefetchInfiniteQueryWithReadableCache(
      context.queryClient,
      options
    )
    if (cause !== "stay" && request) await request
  },
  pendingComponent: ServiceAccountsPending,
  component: ServiceAccountsPage,
})
