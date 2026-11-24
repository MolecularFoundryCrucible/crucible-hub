import { z } from "zod"
import {
  collectionCursorSchema,
  instrumentAffiliationSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import { instrumentStatuses } from "@/data/crucible/instrument-status"

export const instrumentSortFieldSchema = z.enum([
  "name",
  "created",
  "updated",
  "activity",
])

export const instrumentStatusFilterSchema = z.enum([
  ...instrumentStatuses,
  "all",
])

export const instrumentSearchSchema = z.object({
  affiliation: instrumentAffiliationSchema.optional().catch(undefined),
  cursor: collectionCursorSchema,
  direction: sortDirectionSchema.optional().catch(undefined),
  instrumentType: z.string().trim().min(1).max(255).optional().catch(undefined),
  location: z.string().trim().min(1).max(255).optional().catch(undefined),
  manufacturer: z.string().trim().min(1).max(255).optional().catch(undefined),
  ownerId: z.string().trim().min(1).max(255).optional().catch(undefined),
  sort: instrumentSortFieldSchema.optional().catch(undefined),
  status: instrumentStatusFilterSchema.optional().catch(undefined),
})
