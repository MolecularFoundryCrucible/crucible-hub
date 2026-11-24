import { createFileRoute } from "@tanstack/react-router"
import { canOpenUserAdministration } from "@/data/crucible/administration"
import {
  crucibleKeys,
  identityScopeWithPrivilegeMode,
} from "@/data/crucible/query-keys"
import {
  userAdminPageLimit,
  usersCursorQueryOptions,
} from "@/data/crucible/users.queries"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import { UsersPending, UsersAdminPage } from "@/features/admin/users-page"
import { apiUserSort, userSearchSchema } from "@/features/admin/users-search"

export const Route = createFileRoute("/_app/admin/users/")({
  head: () => ({ meta: [{ title: "Users | Crucible Hub" }] }),
  validateSearch: userSearchSchema,
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
    if (!account || !canOpenUserAdministration(account, source.privilegeMode))
      return
    const administrationScope = identityScopeWithPrivilegeMode(
      source.scope,
      "elevated"
    )
    const options = usersCursorQueryOptions(administrationScope, {
      activity: deps.activity,
      cursor: deps.cursor,
      direction: deps.direction,
      includeTotal: true,
      is_service_account: false,
      limit: userAdminPageLimit,
      query: deps.query,
      sort: apiUserSort(deps.sort),
    })
    const request = prefetchInfiniteQueryWithReadableCache(
      context.queryClient,
      options
    )
    if (cause !== "stay" && request) await request
  },
  pendingComponent: UsersPending,
  component: UsersAdminPage,
})
