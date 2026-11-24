import { createFileRoute } from "@tanstack/react-router"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import {
  deletionAuditInfiniteQueryOptions,
  deletionRequestPageLimit,
  deletionRequestsInfiniteQueryOptions,
} from "@/data/crucible/deletion-requests.queries"
import { DeletionRequestsPage } from "@/features/deletion-requests/deletion-requests-page"
import {
  deletionRequestStatus,
  deletionRequestScope,
  defaultDeletionRequestDirection,
  deletionAuditScope,
  deletionRequestSearchSchema,
} from "@/features/deletion-requests/deletion-requests-search"

export const Route = createFileRoute("/_app/deletion-requests")({
  head: () => ({ meta: [{ title: "Deletion requests | Crucible Hub" }] }),
  validateSearch: deletionRequestSearchSchema,
  loaderDeps: ({ search }) => ({
    direction: search.direction,
    projectMfid: search.projectMfid,
    sort: search.sort ?? "request_time",
    view: search.view ?? "submitted",
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const account = context.queryClient.getQueryData(
      accountQueryOptions(source.scope).queryKey
    )
    const scope = source.scope
    if (deps.view === "approved") {
      if (!account || account.is_service_account) return
      const request = prefetchInfiniteQueryWithReadableCache(
        context.queryClient,
        deletionAuditInfiniteQueryOptions(
          scope,
          deletionAuditScope(source.privilegeMode)
        )
      )
      if (cause !== "stay" && request) await request
      return
    }
    const options = deletionRequestsInfiniteQueryOptions(scope, {
      direction: deps.direction ?? defaultDeletionRequestDirection(deps.sort),
      limit: deletionRequestPageLimit,
      projectMfid: deps.projectMfid,
      scope: deletionRequestScope(deps.view),
      sort: deps.sort,
      status: deletionRequestStatus(deps.view),
    })
    const request = prefetchInfiniteQueryWithReadableCache(
      context.queryClient,
      options
    )
    if (cause !== "stay" && request) await request
  },
  component: DeletionRequestsPage,
})
