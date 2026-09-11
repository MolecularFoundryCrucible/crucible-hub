import { z } from "zod"

import type { ResourceSort, SortDirection } from "./collection-query"
import type { ProjectScope } from "./data.queries"
import type {
  DatasetFacetField,
  DatasetFacetFilters,
  FacetSelection,
  SampleFacetField,
  SampleFacetFilters,
} from "./facets"

export const collectionBrowseSearchFields = {
  groupBy: z
    .enum([
      "sample_type",
      "session",
      "measurement",
      "data_format",
      "owner",
      "instrument",
      "project",
    ])
    .optional()
    .catch(undefined),
  groupValue: z.string().max(255).optional().catch(undefined),
  groupValueIsNull: z
    .union([z.literal(true), z.literal("true")])
    .transform(() => true as const)
    .optional()
    .catch(undefined),
  groupValueSet: z
    .union([z.literal(true), z.literal("true")])
    .transform(() => true as const)
    .optional()
    .catch(undefined),
  view: z.enum(["grouped"]).optional().catch(undefined),
}

export type CollectionBrowseSearch = {
  groupBy?: string
  groupValue?: string
  groupValueIsNull?: true
  groupValueSet?: true
  view?: "grouped"
}

export type CollectionBrowseOption<TField extends string> = {
  label: string
  value: TField
}

export const globalSampleBrowseOptions = [
  { label: "Sample type", value: "sample_type" },
  { label: "Owner", value: "owner" },
  { label: "Primary project", value: "project" },
] as const satisfies readonly CollectionBrowseOption<SampleFacetField>[]

export const projectSampleBrowseOptions = [
  { label: "Sample type", value: "sample_type" },
  { label: "Owner", value: "owner" },
] as const satisfies readonly CollectionBrowseOption<SampleFacetField>[]

export const globalDatasetBrowseOptions = [
  { label: "Measurement", value: "measurement" },
  { label: "Instrument", value: "instrument" },
  { label: "Owner", value: "owner" },
  { label: "Primary project", value: "project" },
  { label: "Session", value: "session" },
  { label: "Data format", value: "data_format" },
] as const satisfies readonly CollectionBrowseOption<DatasetFacetField>[]

export const projectDatasetBrowseOptions = [
  { label: "Measurement", value: "measurement" },
  { label: "Instrument", value: "instrument" },
  { label: "Owner", value: "owner" },
  { label: "Session", value: "session" },
  { label: "Data format", value: "data_format" },
] as const satisfies readonly CollectionBrowseOption<DatasetFacetField>[]

export const instrumentDatasetBrowseOptions = [
  { label: "Measurement", value: "measurement" },
  { label: "Owner", value: "owner" },
  { label: "Primary project", value: "project" },
  { label: "Session", value: "session" },
  { label: "Data format", value: "data_format" },
] as const satisfies readonly CollectionBrowseOption<DatasetFacetField>[]

export function resolveCollectionBrowse<TField extends string>(
  search: CollectionBrowseSearch,
  options: readonly CollectionBrowseOption<TField>[]
) {
  const field =
    options.find((option) => option.value === search.groupBy)?.value ??
    options[0].value
  const selection: FacetSelection = search.groupValueIsNull
    ? { kind: "null" }
    : search.groupValueSet
      ? { kind: "value", value: search.groupValue ?? "" }
      : { kind: "all" }
  return {
    field,
    selection,
    view: search.view === "grouped" ? "grouped" : "list",
  } as const
}

export function collectionBrowseSearchState(
  selection: FacetSelection
): Pick<
  CollectionBrowseSearch,
  "groupValue" | "groupValueIsNull" | "groupValueSet"
> {
  if (selection.kind === "null") {
    return {
      groupValue: undefined,
      groupValueIsNull: true,
      groupValueSet: undefined,
    }
  }
  if (selection.kind === "value") {
    return {
      groupValue: selection.value,
      groupValueIsNull: undefined,
      groupValueSet: true,
    }
  }
  return {
    groupValue: undefined,
    groupValueIsNull: undefined,
    groupValueSet: undefined,
  }
}

export function clearCollectionGroupFilterSearch(
  field: DatasetFacetField | SampleFacetField
) {
  if (field === "sample_type") {
    return {
      sampleType: undefined,
      sampleTypeIsNull: undefined,
      sampleTypeSet: undefined,
    }
  }
  if (field === "measurement") {
    return {
      measurement: undefined,
      measurementIsNull: undefined,
      measurementSet: undefined,
    }
  }
  if (field === "session") {
    return {
      sessionName: undefined,
      sessionNameIsNull: undefined,
      sessionNameSet: undefined,
    }
  }
  if (field === "data_format") {
    return {
      dataFormat: undefined,
      dataFormatIsNull: undefined,
      dataFormatSet: undefined,
    }
  }
  if (field === "owner") {
    return {
      ownerId: undefined,
      ownerIdIsNull: undefined,
      ownerIdSet: undefined,
    }
  }
  if (field === "instrument") {
    return { instrumentMfid: undefined, instrumentMfidIsNull: undefined }
  }
  return { projectMfid: undefined, projectScope: undefined }
}

export function sampleFiltersForGroup<
  TFilters extends SampleFacetFilters & {
    direction?: SortDirection
    projectMfid?: string
    projectMfidIsNull?: true
    projectScope?: ProjectScope
    sort?: ResourceSort
  },
>(filters: TFilters, field: SampleFacetField, selection: FacetSelection) {
  const next = { ...filters }
  if (field === "sample_type") {
    delete next.sampleType
    delete next.sampleTypeIsNull
    if (selection.kind === "value") next.sampleType = selection.value
    if (selection.kind === "null") next.sampleTypeIsNull = true
  }
  if (field === "owner") {
    delete next.ownerId
    delete next.ownerIdIsNull
    if (selection.kind === "value") next.ownerId = selection.value
    if (selection.kind === "null") next.ownerIdIsNull = true
  }
  if (field === "project") {
    delete next.projectMfid
    delete next.projectMfidIsNull
    delete next.projectScope
    if (selection.kind === "value") {
      next.projectMfid = selection.value
      next.projectScope = "assigned"
    }
    if (selection.kind === "null") next.projectMfidIsNull = true
  }
  return withBrowseDefaultSort(next)
}

export function datasetFiltersForGroup<
  TFilters extends DatasetFacetFilters & {
    direction?: SortDirection
    instrumentMfid?: string
    projectMfid?: string
    projectMfidIsNull?: true
    projectScope?: ProjectScope
    sort?: ResourceSort
  },
>(filters: TFilters, field: DatasetFacetField, selection: FacetSelection) {
  const next = { ...filters }
  if (field === "measurement") {
    delete next.measurement
    delete next.measurementIsNull
    if (selection.kind === "value") next.measurement = selection.value
    if (selection.kind === "null") next.measurementIsNull = true
  }
  if (field === "session") {
    delete next.sessionName
    delete next.sessionNameIsNull
    if (selection.kind === "value") next.sessionName = selection.value
    if (selection.kind === "null") next.sessionNameIsNull = true
  }
  if (field === "data_format") {
    delete next.dataFormat
    delete next.dataFormatIsNull
    if (selection.kind === "value") next.dataFormat = selection.value
    if (selection.kind === "null") next.dataFormatIsNull = true
  }
  if (field === "owner") {
    delete next.ownerId
    delete next.ownerIdIsNull
    if (selection.kind === "value") next.ownerId = selection.value
    if (selection.kind === "null") next.ownerIdIsNull = true
  }
  if (field === "instrument") {
    delete next.instrumentMfid
    delete next.instrumentMfidIsNull
    if (selection.kind === "value") next.instrumentMfid = selection.value
    if (selection.kind === "null") next.instrumentMfidIsNull = true
  }
  if (field === "project") {
    delete next.projectMfid
    delete next.projectMfidIsNull
    delete next.projectScope
    if (selection.kind === "value") {
      next.projectMfid = selection.value
      next.projectScope = "assigned"
    }
    if (selection.kind === "null") next.projectMfidIsNull = true
  }
  return withBrowseDefaultSort(next)
}

function withBrowseDefaultSort<
  TFilters extends { direction?: SortDirection; sort?: ResourceSort },
>(filters: TFilters) {
  if (filters.sort) {
    return {
      ...filters,
      direction: filters.direction ?? "desc",
    }
  }
  return {
    ...filters,
    direction: "asc" as const,
    sort: "name" as const,
  }
}
