import { z } from "zod"
import {
  collectionCursorSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import { userActivityFilters } from "@/data/crucible/user-activity"

const userSortFieldSchema = z.enum([
  "account",
  "unique_id",
  "email",
  "last_active",
])

export type UserSortField = z.infer<typeof userSortFieldSchema>

export function apiUserSort(sort: UserSortField | undefined) {
  if (sort === "account") return "name" as const
  return sort
}

export const userSearchSchema = z.object({
  activity: z.enum(userActivityFilters).optional().catch(undefined),
  create: z.boolean().optional().catch(undefined),
  cursor: collectionCursorSchema,
  direction: sortDirectionSchema.optional().catch(undefined),
  q: z.string().trim().min(3).max(200).optional().catch(undefined),
  sort: userSortFieldSchema.optional().catch(undefined),
})
