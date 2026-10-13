import type { IdentityScope } from "./query-keys"

export const fixtureResourcePageLimit = 50

type PreviousQuery = {
  queryKey: readonly unknown[]
}

export function identityScopedPreviousData<TData>(
  scope: IdentityScope,
  previousData: TData | undefined,
  previousQuery: PreviousQuery | undefined
) {
  const queryKey = previousQuery?.queryKey
  if (!queryKey) return undefined
  return scope.every((part, index) => queryKey[index] === part)
    ? previousData
    : undefined
}

export function collectionScopedPreviousData<TData>(
  scope: IdentityScope,
  context: Record<string, unknown>,
  previousData: TData | undefined,
  previousQuery: PreviousQuery | undefined
) {
  if (
    identityScopedPreviousData(scope, previousData, previousQuery) === undefined
  ) {
    return undefined
  }
  const previousContext =
    previousQuery?.queryKey[6] === "cursor-chain"
      ? previousQuery.queryKey[7]
      : previousQuery?.queryKey[6]
  if (typeof previousContext !== "object" || previousContext === null) {
    return undefined
  }
  return Object.entries(context).every(
    ([key, value]) =>
      (previousContext as Record<string, unknown>)[key] === value
  )
    ? previousData
    : undefined
}

export function fixtureCursorPage<TItem>(
  items: readonly TItem[],
  { cursor, limit }: { cursor?: string; limit: number }
) {
  const match = cursor?.match(/^fixture:(\d+)$/)
  if (cursor && !match) throw new Error("The fixture cursor is invalid.")
  const offset = match ? Number(match[1]) : 0
  const pageItems = items.slice(offset, offset + limit)
  const nextOffset = offset + pageItems.length
  return {
    items: pageItems,
    limit,
    nextCursor:
      nextOffset < items.length ? `fixture:${String(nextOffset)}` : null,
    total: items.length,
  }
}
