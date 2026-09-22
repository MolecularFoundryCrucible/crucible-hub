import { QueryClient } from "@tanstack/react-query"
import type { Query } from "@tanstack/react-query"

import { HubApiClientError } from "@/data/crucible/result"

const dehydratedQueryFamilies = new Set([
  "account",
  "admin",
  "datasets",
  "instruments",
  "people",
  "projects",
  "resources",
  "samples",
])

const maximumRetryCount = 2
const maximumRetryDelay = 30_000

export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (error instanceof HubApiClientError && !error.details.retryable) {
    return false
  }
  if (
    error instanceof HubApiClientError &&
    error.details.retryAfterSeconds !== undefined &&
    error.details.retryAfterSeconds * 1_000 > maximumRetryDelay
  ) {
    return false
  }
  return failureCount < maximumRetryCount
}

export function queryRetryDelay(attemptIndex: number, error: unknown) {
  if (
    error instanceof HubApiClientError &&
    error.details.retryAfterSeconds !== undefined
  ) {
    return Math.min(error.details.retryAfterSeconds * 1_000, maximumRetryDelay)
  }
  return Math.min(1_000 * 2 ** attemptIndex, maximumRetryDelay)
}

export function shouldDehydrateCrucibleQuery(query: Query) {
  const [namespace, serverId, accountMfid, privilegeMode, family] =
    query.queryKey
  return (
    query.state.status === "success" &&
    query.state.data !== undefined &&
    namespace === "crucible" &&
    typeof serverId === "string" &&
    serverId.length > 0 &&
    typeof accountMfid === "string" &&
    accountMfid.length > 0 &&
    privilegeMode === "normal" &&
    typeof family === "string" &&
    dehydratedQueryFamilies.has(family)
  )
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        retryDelay: queryRetryDelay,
      },
      dehydrate: {
        shouldDehydrateQuery: shouldDehydrateCrucibleQuery,
      },
    },
  })
}
