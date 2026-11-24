import {
  resolveCollectionAffiliation,
  publicDataSearchSchema,
} from "@/data/crucible/public-data"
import type {
  PublicDataAccess,
  PublicDataChoice,
} from "@/data/crucible/public-data"
import type { WorkspaceSearchKind } from "@/data/crucible/workspace-source"
import { z } from "zod"

export type SearchTab = WorkspaceSearchKind | "all" | "metadata"

export type SearchFilterValues = {
  affiliation?: "owner"
  publicData?: PublicDataChoice
}

export function searchFilterAvailability(tab: SearchTab) {
  const data = tab === "all" || tab === "sample" || tab === "dataset"
  return {
    ownership: tab !== "person",
    project: data,
    publicData: data || tab === "metadata",
  }
}

export function searchAffiliation(
  tab: SearchTab,
  values: SearchFilterValues,
  access: PublicDataAccess
) {
  const availability = searchFilterAvailability(tab)
  if (!availability.ownership) return undefined
  const affiliation = resolveCollectionAffiliation({
    ...access,
    ownership: values.affiliation,
    publicData: values.publicData,
  })
  return affiliation === "member" && !availability.publicData
    ? undefined
    : affiliation
}

export function searchKindsForFilters(
  tab: SearchTab,
  kinds: readonly WorkspaceSearchKind[],
  values: SearchFilterValues
) {
  return tab === "all" && values.affiliation === "owner"
    ? kinds.filter((kind) => kind !== "person")
    : kinds
}

export const kinds = [
  "person",
  "project",
  "instrument",
  "sample",
  "dataset",
] as const satisfies readonly WorkspaceSearchKind[]

export const searchSchema = z.object({
  affiliation: z.enum(["owner"]).optional().catch(undefined),
  kind: z.enum(kinds).optional().catch(undefined),
  mode: z.enum(["metadata"]).optional().catch(undefined),
  projectMfid: z.string().trim().min(1).max(255).optional().catch(undefined),
  publicData: publicDataSearchSchema.optional().catch(undefined),
  q: z.string().trim().max(200).optional().catch(undefined),
})
