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
  const previousContext = previousQuery?.queryKey[5]
  if (typeof previousContext !== "object" || previousContext === null) {
    return undefined
  }
  return Object.entries(context).every(
    ([key, value]) =>
      key in previousContext &&
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
