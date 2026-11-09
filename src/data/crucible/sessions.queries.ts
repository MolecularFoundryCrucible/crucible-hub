import { infiniteQueryOptions } from "@tanstack/react-query"

import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"
import { getWorkspaceSessions } from "./sessions.functions"

const sessionPageLimit = 50

export function sessionsQueryKey(
  scope: IdentityScope,
  userId: string | undefined
) {
  return userId
    ? crucibleKeys.userSessions(scope, userId)
    : crucibleKeys.accountSessions(scope)
}

export function sessionsInfiniteQueryOptions(
  scope: IdentityScope,
  userId: string | undefined
) {
  const scenario = fixtureScenarioFromScope(scope)
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: sessionsQueryKey(scope, userId),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceSessions({
          data: {
            cursor: pageParam ?? undefined,
            limit: sessionPageLimit,
            scenario,
            userId,
          },
          signal,
        })
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: scenario ? false : undefined,
  })
}
