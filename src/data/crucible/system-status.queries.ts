import { queryOptions } from "@tanstack/react-query"

import { crucibleKeys } from "./query-keys"
import { backgroundRequestHeader } from "./background-request"
import { getSystemStatus } from "./system-status.functions"

export interface SystemStatusQueryOptions {
  bypassCache?: boolean
  enabled?: boolean
}

export function systemStatusQueryOptions(
  options: SystemStatusQueryOptions = {}
) {
  return queryOptions({
    queryKey: crucibleKeys.systemStatus(),
    queryFn: async ({ signal }) =>
      getSystemStatus({
        data: { bypassCache: options.bypassCache },
        headers: { [backgroundRequestHeader]: "1" },
        signal,
      }),
    enabled: options.enabled ?? true,
    staleTime: 15_000,
    gcTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
