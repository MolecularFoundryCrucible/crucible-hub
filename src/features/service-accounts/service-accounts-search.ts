import { z } from "zod"
import {
  collectionCursorSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import { userActivityFilters } from "@/data/crucible/user-activity"

const serviceAccountSortFieldSchema = z.enum([
  "account",
  "unique_id",
  "last_active",
])

export type ServiceAccountSortField = z.infer<
  typeof serviceAccountSortFieldSchema
>

export function apiServiceAccountSort(
  sort: ServiceAccountSortField | undefined
) {
  if (!sort || sort === "account") return "username" as const
  return sort
}

export const serviceAccountSearchSchema = z.object({
  activity: z.enum(userActivityFilters).optional().catch(undefined),
  create: z.boolean().optional().catch(undefined),
  cursor: collectionCursorSchema,
  direction: sortDirectionSchema.optional().catch(undefined),
  q: z.string().trim().min(1).max(200).optional().catch(undefined),
  sort: serviceAccountSortFieldSchema.optional().catch(undefined),
})
