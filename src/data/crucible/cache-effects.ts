import type { QueryClient } from "@tanstack/react-query"

import { crucibleKeys } from "./query-keys"
import type { IdentityScope } from "./query-keys"
import type {
  WorkspaceAccount,
  WorkspacePerson,
  WorkspaceResourceDetail,
} from "./workspace-source"

export function applyAccountProfileUpdate(
  queryClient: QueryClient,
  scope: IdentityScope,
  account: WorkspaceAccount
) {
  queryClient.setQueryData(crucibleKeys.accountProfile(scope), account)
  return applyPersonProfileUpdate(queryClient, scope, account)
}

export function applyPersonProfileUpdate(
  queryClient: QueryClient,
  scope: IdentityScope,
  person: WorkspacePerson
) {
  queryClient.setQueryData(crucibleKeys.person(scope, person.unique_id), {
    first_name: person.first_name,
    is_service_account: person.is_service_account,
    last_name: person.last_name,
    unique_id: person.unique_id,
    username: person.username,
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

export function invalidateResourceDiscoveryQueries(
  queryClient: QueryClient,
  scope: IdentityScope
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.sampleQueries(scope),
    }),
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.datasetQueries(scope),
    }),
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.projectQueries(scope),
    }),
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.instrumentQueries(scope),
    }),
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.resourceGraphs(scope),
    }),
    queryClient.invalidateQueries({ queryKey: crucibleKeys.searches(scope) }),
  ])
}

export function invalidateDeletionRequestMutationQueries(
  queryClient: QueryClient,
  scope: IdentityScope,
  resourceMfids: string | readonly string[]
) {
  const mfids = [
    ...new Set(
      typeof resourceMfids === "string" ? [resourceMfids] : resourceMfids
    ),
  ]
  return Promise.all([
    invalidateResourceDiscoveryQueries(queryClient, scope),
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.deletionRequestQueries(scope),
    }),
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.deletionAuditQueries(scope),
    }),
    ...mfids.map((resourceMfid) =>
      queryClient.invalidateQueries({
        queryKey: crucibleKeys.resourceDetails(scope, resourceMfid),
      })
    ),
  ])
}
