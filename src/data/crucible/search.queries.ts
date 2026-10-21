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
  serviceAccountsOnly = false,
  affiliation?: "member"
) {
  return workspaceSearchQueryOptions(
    scope,
    query,
    kinds,
    searchGroupLimit,
    projectMfid,
    serviceAccountsOnly,
    affiliation
  )
}

export function quickSearchQueryOptions(
  scope: IdentityScope,
  query: string,
  kinds: readonly WorkspaceSearchKind[],
  projectMfid?: string,
  affiliation?: "member"
) {
  return workspaceSearchQueryOptions(
    scope,
    query,
    kinds,
    quickSearchGroupLimit,
    projectMfid,
    false,
    affiliation
  )
}

function workspaceSearchQueryOptions(
  scope: IdentityScope,
  query: string,
  kinds: readonly WorkspaceSearchKind[],
  limit: number,
  projectMfid?: string,
  serviceAccountsOnly = false,
  affiliation?: "member"
) {
  const normalizedKinds = [...kinds].sort()
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.search(scope, {
      affiliation: affiliation ?? null,
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
            affiliation,
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
  query: string,
  affiliation?: "member"
) {
  const scenario = fixtureScenarioFromScope(scope)
  return queryOptions({
    queryKey: crucibleKeys.search(scope, {
      affiliation: affiliation ?? null,
      limit: 40,
      mode: "metadata",
      query,
    }),
    queryFn: async ({ signal }) =>
      unwrapHubResult(
        await getWorkspaceMetadataSearch({
          data: { affiliation, limit: 40, query, scenario },
          signal,
        })
      ),
    retry: scenario ? false : undefined,
  })
}
