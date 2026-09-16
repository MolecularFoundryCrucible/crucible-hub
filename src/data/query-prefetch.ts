import type {
  FetchInfiniteQueryOptions,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query"

export function prefetchInfiniteQueryWithReadableCache<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
  TPageParam,
>(
  queryClient: QueryClient,
  options: FetchInfiniteQueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey,
    TPageParam
  >
) {
  const hasData = queryClient.getQueryData(options.queryKey) !== undefined
  const request = queryClient.prefetchInfiniteQuery(options)
  return hasData ? undefined : request
}
