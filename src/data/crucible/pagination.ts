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

/**
 * Previous results of the same kind only: the key parameters named in `kind`
 * (a facet field, a search mode) must match, so a list never shows another
 * kind of item while it loads.
 */
export function sameKindPreviousData<TData>(
  scope: IdentityScope,
  kind: Record<string, unknown>,
  previousData: TData | undefined,
  previousQuery: PreviousQuery | undefined
) {
  if (
    identityScopedPreviousData(scope, previousData, previousQuery) === undefined
  )
    return undefined
  const params = [...(previousQuery?.queryKey ?? [])]
    .reverse()
    .find(
      (part): part is Record<string, unknown> =>
        typeof part === "object" && part !== null && !Array.isArray(part)
    )
  return Object.entries(kind).every(([key, value]) => params?.[key] === value)
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
