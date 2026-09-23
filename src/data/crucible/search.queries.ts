import { queryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import {
  getWorkspaceMetadataSearch,
  getWorkspaceSearch,
} from "./search.functions"
import { unwrapHubResult } from "./result"
import type { WorkspaceSearchKind } from "./workspace-source"

export const searchGroupLimit = 8
export const quickSearchGroupLimit = 2

export function searchQueryOptions(
  scope: IdentityScope,
  query: string,
  kinds: readonly WorkspaceSearchKind[],
  projectMfid?: string,
  serviceAccountsOnly = false
) {
  return workspaceSearchQueryOptions(
    scope,
    query,
    kinds,
    searchGroupLimit,
    projectMfid,
    serviceAccountsOnly
  )
}

export function quickSearchQueryOptions(
  scope: IdentityScope,
  query: string,
  kinds: readonly WorkspaceSearchKind[],
  projectMfid?: string
) {
  return workspaceSearchQueryOptions(
    scope,
    query,
    kinds,
    quickSearchGroupLimit,
    projectMfid
  )
}

function workspaceSearchQueryOptions(
  scope: IdentityScope,
  query: string,
  kinds: readonly WorkspaceSearchKind[],
  limit: number,
  projectMfid?: string,
  serviceAccountsOnly = false
) {
  const normalizedKinds = [...kinds].sort()
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.search(scope, {
      kinds: normalizedKinds,
      limit,
      projectMfid: projectMfid ?? null,
      query,
      serviceAccountsOnly,
    }),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceSearch({
          data: {
            kinds: [...kinds],
            limit,
            projectMfid,
            query,
            scenario,
            serviceAccountsOnly,
          },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}

export function metadataSearchQueryOptions(
  scope: IdentityScope,
  query: string
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.search(scope, {
      limit: 40,
      mode: "metadata",
      query,
    }),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceMetadataSearch({
          data: { limit: 40, query, scenario },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}
