import type { instrumentDatasetScope } from "@/data/crucible/instrument-dataset-scope"
import { instrumentDatasetAccessSchema } from "@/data/crucible/instrument-dataset-scope"
import { publicDataSearchSchema } from "@/data/crucible/public-data"
import { z } from "zod"
import { resourcePreviewSearchSchema } from "@/data/crucible/resource-preview-search"
import { collectionBrowseSearchFields } from "@/data/crucible/collection-browse"
import { collectionFilterFields } from "@/data/crucible/collection-filters"
import {
  resourceSortSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"

export const instrumentDatasetSearchSchema = resourcePreviewSearchSchema.extend(
  {
    ...collectionBrowseSearchFields,
    access: instrumentDatasetAccessSchema.optional().catch(undefined),
    createdFrom: collectionFilterFields.createdFrom.catch(undefined),
    createdTo: collectionFilterFields.createdTo.catch(undefined),
    cursor: z.string().min(1).max(2048).optional().catch(undefined),
    direction: sortDirectionSchema.optional().catch(undefined),
    publicData: publicDataSearchSchema.optional().catch(undefined),
    sort: resourceSortSchema.optional().catch(undefined),
  }
)

export function datasetScopeFilters({
  affiliation,
  includeInstrumentAccess,
}: ReturnType<typeof instrumentDatasetScope>) {
  return {
    affiliation,
    ...(includeInstrumentAccess ? { includeInstrumentAccess } : {}),
  }
}
