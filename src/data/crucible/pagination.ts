import type { IdentityScope } from "./query-keys"

type PreviousQuery = {
  queryKey: readonly unknown[]
}

export function identityScopedPreviousData<TData>(
  scope: IdentityScope,
  previousData: TData | undefined,
  previousQuery: PreviousQuery | undefined
) {
  const queryKey = previousQuery?.queryKey
  return queryKey?.[0] === scope[0] &&
    queryKey[1] === scope[1] &&
    queryKey[2] === scope[2]
    ? previousData
    : undefined
}
