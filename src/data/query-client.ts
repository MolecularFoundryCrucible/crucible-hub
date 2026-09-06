import { QueryClient } from "@tanstack/react-query"
import type { Query } from "@tanstack/react-query"

const dehydratedQueryFamilies = new Set([
  "account",
  "datasets",
  "instruments",
  "people",
  "projects",
  "resources",
  "samples",
  "workspace",
])

export function shouldDehydrateCrucibleQuery(query: Query) {
  const [namespace, serverId, accountMfid, family] = query.queryKey
  return (
    query.state.status === "success" &&
    query.state.data !== undefined &&
    namespace === "crucible" &&
    typeof serverId === "string" &&
    serverId.length > 0 &&
    typeof accountMfid === "string" &&
    accountMfid.length > 0 &&
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
      },
      dehydrate: {
        shouldDehydrateQuery: shouldDehydrateCrucibleQuery,
      },
    },
  })
}
