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

export function normalizeCollectionQueryOptions(
  options: CollectionQueryOptions
): CollectionQueryOptions {
  return {
    ...(options.affiliation ? { affiliation: options.affiliation } : {}),
    ...(options.sort
      ? { direction: options.direction ?? "desc", sort: options.sort }
      : {}),
  }
}
