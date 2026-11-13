import { z } from "zod"

export const collectionAffiliationSchema = z.enum(["owner", "member"])
export const ownershipAffiliationSchema = z.enum(["owner"])
export const instrumentAffiliationSchema = z.enum(["owner", "managed"])
export const resourceSortSchema = z.enum(["created", "updated", "name"])
export const sortDirectionSchema = z.enum(["asc", "desc"])
export const collectionCursorSchema = z
  .string()
  .min(1)
  .max(4096)
  .optional()
  .catch(undefined)

export type CollectionAffiliation = z.infer<typeof collectionAffiliationSchema>
export type OwnershipAffiliation = z.infer<typeof ownershipAffiliationSchema>
export type InstrumentAffiliation = z.infer<typeof instrumentAffiliationSchema>
export type ResourceSort = z.infer<typeof resourceSortSchema>
export type SortDirection = z.infer<typeof sortDirectionSchema>

export type CollectionQueryOptions = {
  affiliation?: CollectionAffiliation
  direction?: SortDirection
  includeInstrumentAccess?: true
  sort?: ResourceSort
}

export type CollectionOrdering = {
  direction: SortDirection
  sort: ResourceSort
}

export const defaultCollectionOrdering = {
  direction: "desc",
  sort: "created",
} as const satisfies CollectionOrdering

export type NormalizedCollectionQueryOptions = CollectionQueryOptions &
  CollectionOrdering

export function normalizeCollectionQueryOptions(
  options: CollectionQueryOptions,
  defaultOrdering: CollectionOrdering = defaultCollectionOrdering
): NormalizedCollectionQueryOptions {
  const hasExplicitSort = Boolean(options.sort)
  return {
    ...(options.affiliation ? { affiliation: options.affiliation } : {}),
    ...(options.affiliation === "member" && options.includeInstrumentAccess
      ? { includeInstrumentAccess: true as const }
      : {}),
    direction: hasExplicitSort
      ? (options.direction ?? defaultCollectionOrdering.direction)
      : defaultOrdering.direction,
    sort: options.sort ?? defaultOrdering.sort,
  }
}

export function collectionOrderingSearchState(
  sort: ResourceSort | undefined,
  direction: SortDirection | undefined,
  defaultOrdering: CollectionOrdering = defaultCollectionOrdering
) {
  const normalized = normalizeCollectionQueryOptions(
    { direction, sort },
    defaultOrdering
  )
  if (
    normalized.sort === defaultOrdering.sort &&
    normalized.direction === defaultOrdering.direction
  ) {
    return { direction: undefined, sort: undefined }
  }
  return {
    direction: normalized.direction,
    sort: normalized.sort,
  }
}

/** The dataset affiliation values the API takes for these options. */
export function datasetAffiliationQuery(
  options: Pick<
    CollectionQueryOptions,
    "affiliation" | "includeInstrumentAccess"
  >
): ("instrument" | CollectionAffiliation)[] | undefined {
  if (!options.affiliation) return undefined
  return options.affiliation === "member" && options.includeInstrumentAccess
    ? ["member", "instrument"]
    : [options.affiliation]
}
