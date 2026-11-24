import { z } from "zod"
import { dateOnlySchema } from "@/data/crucible/collection-filters"
import {
  ownershipAffiliationSchema,
  collectionCursorSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"

export const projectSortFieldSchema = z.enum([
  "name",
  "created",
  "updated",
  "activity",
])

export const projectRoleFilterSchema = z.enum([
  "admin",
  "editor",
  "contributor",
  "viewer",
])

export const projectSearchSchema = z.object({
  activeSince: dateOnlySchema.optional().catch(undefined),
  affiliation: ownershipAffiliationSchema.optional().catch(undefined),
  cursor: collectionCursorSchema,
  direction: sortDirectionSchema.optional().catch(undefined),
  role: projectRoleFilterSchema.optional().catch(undefined),
  sort: projectSortFieldSchema.optional().catch(undefined),
})
