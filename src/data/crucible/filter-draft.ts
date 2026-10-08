import type { FacetSelection } from "./facets"

export type FacetValueKey =
  "dataFormat" | "measurement" | "ownerId" | "sampleType" | "sessionName"

export function facetSummary(
  label: string,
  value: string | undefined,
  isNull: true | undefined
) {
  if (isNull) return `${label}: Unspecified`
  if (value === undefined) return undefined
  return `${label}: ${value || "Empty value"}`
}

export function facetSelection(
  value: string | undefined,
  selected: true | undefined,
  isNull: true | undefined
): FacetSelection {
  if (isNull) return { kind: "null" }
  return selected ? { kind: "value", value: value ?? "" } : { kind: "all" }
}

export function setFacetDraft<TFilters>(
  filters: TFilters,
  valueKey: FacetValueKey,
  selectedKey: `${FacetValueKey}Set`,
  nullKey: `${FacetValueKey}IsNull`,
  selection: FacetSelection
): TFilters {
  return {
    ...filters,
    [nullKey]: selection.kind === "null" || undefined,
    [selectedKey]: selection.kind === "value" || undefined,
    [valueKey]: selection.kind === "value" ? selection.value : undefined,
  }
}

export function sortLabel(sort: string) {
  if (sort === "created") return "Created"
  if (sort === "updated") return "Updated"
  return "Name"
}

export function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}
