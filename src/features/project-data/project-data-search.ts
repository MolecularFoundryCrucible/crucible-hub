import { publicDataSearchSchema } from "@/data/crucible/public-data"
import { z } from "zod"
import { collectionBrowseSearchFields } from "@/data/crucible/collection-browse"
import { resourcePreviewSearchSchema } from "@/components/crucible/resource-preview-navigation"
import {
  collectionCursorSchema,
  resourceSortSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import { facetFilterSearchFields } from "@/data/crucible/facet-filter-search"

const filterSearchValue = z.string().max(255).optional().catch("")

const selectedFacetSchema = z
  .union([z.literal(true), z.literal("true")])
  .transform(() => true as const)
  .optional()
  .catch(undefined)

export const projectDataSearchSchema = resourcePreviewSearchSchema.extend({
  ...collectionBrowseSearchFields,
  ...facetFilterSearchFields,
  createdFrom: filterSearchValue,
  createdTo: filterSearchValue,
  direction: sortDirectionSchema.optional().catch(undefined),
  instrumentMfid: filterSearchValue,
  instrumentMfidIsNull: selectedFacetSchema,
  kind: z.enum(["samples", "datasets"]).optional().catch(undefined),
  scope: z.enum(["all", "assigned", "shared"]).optional().catch(undefined),
  sampleCursor: collectionCursorSchema,
  datasetCursor: collectionCursorSchema,
  publicData: publicDataSearchSchema.optional().catch(undefined),
  sort: resourceSortSchema.optional().catch(undefined),
  visibility: filterSearchValue,
})
