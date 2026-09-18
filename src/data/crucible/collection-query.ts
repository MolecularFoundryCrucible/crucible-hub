import { z } from "zod"

export const collectionAffiliationSchema = z.enum(["owner"])
export const resourceSortSchema = z.enum(["created", "updated", "name"])
export const sortDirectionSchema = z.enum(["asc", "desc"])
export const collectionCursorSchema = z
  .string()
  .min(1)
  .max(4096)
  .optional()
  .catch(undefined)

export type CollectionAffiliation = z.infer<typeof collectionAffiliationSchema>
export type ResourceSort = z.infer<typeof resourceSortSchema>
export type SortDirection = z.infer<typeof sortDirectionSchema>

export type CollectionQueryOptions = {
  affiliation?: CollectionAffiliation
  direction?: SortDirection
  sort?: ResourceSort
}

export const defaultCollectionOrdering = {
  direction: "desc",
  sort: "created",
} as const satisfies {
  direction: SortDirection
  sort: ResourceSort
}

export type NormalizedCollectionQueryOptions = CollectionQueryOptions & {
  direction: SortDirection
  sort: ResourceSort
}

export function normalizeCollectionQueryOptions(
  options: CollectionQueryOptions
): NormalizedCollectionQueryOptions {
  const hasExplicitSort = Boolean(options.sort)
  return {
    ...(options.affiliation ? { affiliation: options.affiliation } : {}),
    direction: hasExplicitSort
      ? (options.direction ?? defaultCollectionOrdering.direction)
      : defaultCollectionOrdering.direction,
    sort: options.sort ?? defaultCollectionOrdering.sort,
  }
}

export function collectionOrderingSearchState(
  sort: ResourceSort | undefined,
  direction: SortDirection | undefined
) {
  const normalized = normalizeCollectionQueryOptions({ direction, sort })
  if (
    normalized.sort === defaultCollectionOrdering.sort &&
    normalized.direction === defaultCollectionOrdering.direction
  ) {
    return { direction: undefined, sort: undefined }
  }
  return {
    direction: normalized.direction,
    sort: normalized.sort,
  }
}
