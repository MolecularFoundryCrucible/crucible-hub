import { z } from "zod"

import type { SortDirection } from "./collection-query"
import type {
  WorkspacePerson,
  WorkspaceProjectReference,
} from "./workspace-source"

export const sampleFacetFieldSchema = z.enum([
  "sample_type",
  "owner",
  "project",
])
export const datasetFacetFieldSchema = z.enum([
  "session",
  "measurement",
  "data_format",
  "owner",
  "instrument",
  "project",
])
export const facetSortSchema = z.enum(["value", "label", "count"])

export type SampleFacetField = z.infer<typeof sampleFacetFieldSchema>
export type DatasetFacetField = z.infer<typeof datasetFacetFieldSchema>
export type FacetSort = z.infer<typeof facetSortSchema>
export type FacetOrdering = {
  direction: SortDirection
  sort: FacetSort
}

export type FacetSelection =
  { kind: "all" } | { kind: "null" } | { kind: "value"; value: string }

export type SampleFacetFilters = {
  ownerId?: string
  ownerIdIsNull?: true
  sampleType?: string
  sampleTypeIsNull?: true
}

export type DatasetFacetFilters = {
  dataFormat?: string
  dataFormatIsNull?: true
  instrumentMfidIsNull?: true
  measurement?: string
  measurementIsNull?: true
  ownerId?: string
  ownerIdIsNull?: true
  sessionName?: string
  sessionNameIsNull?: true
}

export type WorkspaceFacetBucket = {
  count: number
  instrument?: {
    instrument_id?: string | null
    instrument_name: string
    unique_id: string
  } | null
  label?: string | null
  owner?: WorkspacePerson | null
  project?: WorkspaceProjectReference | null
  value: string | null
}

export type WorkspaceFacetPage = {
  field: DatasetFacetField | SampleFacetField
  items: readonly WorkspaceFacetBucket[]
  limit: number
  nextCursor: string | null
}

export function normalizeSampleFacetFilters(
  filters: SampleFacetFilters
): SampleFacetFilters {
  return {
    ...normalizeFacetValue(
      "ownerId",
      "ownerIdIsNull",
      filters.ownerId,
      filters.ownerIdIsNull
    ),
    ...normalizeFacetValue(
      "sampleType",
      "sampleTypeIsNull",
      filters.sampleType,
      filters.sampleTypeIsNull
    ),
  }
}

export function normalizeDatasetFacetFilters(
  filters: DatasetFacetFilters
): DatasetFacetFilters {
  return {
    ...normalizeFacetValue(
      "ownerId",
      "ownerIdIsNull",
      filters.ownerId,
      filters.ownerIdIsNull
    ),
    ...normalizeFacetValue(
      "dataFormat",
      "dataFormatIsNull",
      filters.dataFormat,
      filters.dataFormatIsNull
    ),
    ...normalizeFacetValue(
      "measurement",
      "measurementIsNull",
      filters.measurement,
      filters.measurementIsNull
    ),
    ...normalizeFacetValue(
      "sessionName",
      "sessionNameIsNull",
      filters.sessionName,
      filters.sessionNameIsNull
    ),
    ...(filters.instrumentMfidIsNull ? { instrumentMfidIsNull: true } : {}),
  }
}

function normalizeFacetValue<TValueKey extends string, TNullKey extends string>(
  valueKey: TValueKey,
  nullKey: TNullKey,
  value: string | undefined,
  isNull: true | undefined
): Partial<Record<TValueKey, string> & Record<TNullKey, true>> {
  return value !== undefined
    ? ({ [valueKey]: value } as Partial<
        Record<TValueKey, string> & Record<TNullKey, true>
      >)
    : isNull
      ? ({ [nullKey]: true } as Partial<
          Record<TValueKey, string> & Record<TNullKey, true>
        >)
      : {}
}
