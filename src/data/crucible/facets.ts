import { z } from "zod"

export const sampleFacetFieldSchema = z.literal("sample_type")
export const datasetFacetFieldSchema = z.enum([
  "session",
  "measurement",
  "data_format",
])

export type SampleFacetField = z.infer<typeof sampleFacetFieldSchema>
export type DatasetFacetField = z.infer<typeof datasetFacetFieldSchema>

export type SampleFacetFilters = {
  sampleType?: string
  sampleTypeIsNull?: true
}

export type DatasetFacetFilters = {
  dataFormat?: string
  dataFormatIsNull?: true
  measurement?: string
  measurementIsNull?: true
  sessionName?: string
  sessionNameIsNull?: true
}

export type WorkspaceFacetBucket = {
  count: number
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
  return filters.sampleType !== undefined
    ? { sampleType: filters.sampleType }
    : filters.sampleTypeIsNull
      ? { sampleTypeIsNull: true }
      : {}
}

export function normalizeDatasetFacetFilters(
  filters: DatasetFacetFilters
): DatasetFacetFilters {
  return {
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
