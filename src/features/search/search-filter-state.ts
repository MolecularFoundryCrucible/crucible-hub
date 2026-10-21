import { resolveCollectionAffiliation } from "@/data/crucible/public-data"
import type {
  PublicDataAccess,
  PublicDataChoice,
} from "@/data/crucible/public-data"
import type { WorkspaceSearchKind } from "@/data/crucible/workspace-source"

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
