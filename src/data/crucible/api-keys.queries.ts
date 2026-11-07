import { infiniteQueryOptions } from "@tanstack/react-query"

import { getWorkspaceApiKeys } from "./api-keys.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"
import type { WorkspaceApiKeyState } from "./workspace-source"

const apiKeyPageLimit = 50

function apiKeysQueryKey(
  scope: IdentityScope,
  userId: string | undefined,
  state: WorkspaceApiKeyState
) {
  return userId
    ? crucibleKeys.userApiKeys(scope, userId, state)
    : crucibleKeys.accountApiKeys(scope, state)
}

export function apiKeyQueriesKey(
  scope: IdentityScope,
  userId: string | undefined
) {
  return userId
    ? crucibleKeys.userApiKeyQueries(scope, userId)
    : crucibleKeys.accountApiKeyQueries(scope)
}

export function apiKeysInfiniteQueryOptions(
  scope: IdentityScope,
  userId: string | undefined,
  state: WorkspaceApiKeyState
) {
  const scenario = fixtureScenarioFromScope(scope)
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: apiKeysQueryKey(scope, userId, state),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceApiKeys({
          data: {
            cursor: pageParam ?? undefined,
            limit: apiKeyPageLimit,
            scenario,
            state,
            userId,
          },
          signal,
        })
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: scenario ? false : undefined,
  })
}
