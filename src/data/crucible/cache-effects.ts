import type { QueryClient } from "@tanstack/react-query"

import { crucibleKeys } from "./query-keys"
import type { IdentityScope } from "./query-keys"
import type {
  WorkspaceAccount,
  WorkspaceResourceDetail,
} from "./workspace-source"

export function applyAccountProfileUpdate(
  queryClient: QueryClient,
  scope: IdentityScope,
  account: WorkspaceAccount
) {
  queryClient.setQueryData(crucibleKeys.accountProfile(scope), account)
  queryClient.setQueryData(crucibleKeys.person(scope, account.unique_id), {
    first_name: account.first_name,
    is_service_account: account.is_service_account,
    last_name: account.last_name,
    unique_id: account.unique_id,
    username: account.username,
  })

  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.projectQueries(scope),
    }),
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.instrumentQueries(scope),
    }),
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.sampleQueries(scope),
    }),
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.datasetQueries(scope),
    }),
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.resourceQueries(scope),
    }),
    queryClient.invalidateQueries({ queryKey: crucibleKeys.searches(scope) }),
  ])
}

export function resourceListKey(
  kind: WorkspaceResourceDetail["kind"],
  scope: IdentityScope
) {
  if (kind === "sample") return crucibleKeys.sampleLists(scope)
  if (kind === "dataset") return crucibleKeys.datasetLists(scope)
  if (kind === "instrument") return crucibleKeys.instrumentLists(scope)
  return crucibleKeys.projectLists(scope)
}

export function invalidateResourceMutationQueries(
  queryClient: QueryClient,
  scope: IdentityScope,
  kind: WorkspaceResourceDetail["kind"],
  resourceMfid: string
) {
  const invalidations = [
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.resourceDetails(scope, resourceMfid),
    }),
    queryClient.invalidateQueries({
      queryKey: resourceListKey(kind, scope),
    }),
    queryClient.invalidateQueries({ queryKey: crucibleKeys.searches(scope) }),
  ]
  if (kind === "project") {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: crucibleKeys.project(scope, resourceMfid),
      })
    )
  }
  return Promise.all(invalidations)
}
