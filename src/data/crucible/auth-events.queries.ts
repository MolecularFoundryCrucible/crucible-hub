import { infiniteQueryOptions } from "@tanstack/react-query"

import { getWorkspaceAuthEvents } from "./auth-events.functions"
import { fixtureScenarioFromScope } from "./fixture-scenarios"
import type { IdentityScope } from "./query-keys"
import { crucibleKeys } from "./query-keys"
import { unwrapHubResult } from "./result"

const authEventPageLimit = 20

export function authEventsInfiniteQueryOptions(
  scope: IdentityScope,
  userId: string | undefined
) {
  const scenario = fixtureScenarioFromScope(scope)
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: userId
      ? crucibleKeys.userAuthEvents(scope, userId)
      : crucibleKeys.accountAuthEvents(scope),
    queryFn: async ({ pageParam, signal }) =>
      unwrapHubResult(
        await getWorkspaceAuthEvents({
          data: {
            cursor: pageParam ?? undefined,
            limit: authEventPageLimit,
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
