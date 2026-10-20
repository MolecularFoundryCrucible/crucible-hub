import { z } from "zod"

import { resourceSortSchema, sortDirectionSchema } from "./collection-query"
import { datasetFacetFieldSchema, sampleFacetFieldSchema } from "./facets"
import { printerIdSchema } from "./print"

export const themePreferenceSchema = z.enum(["system", "light", "dark"])
export const recordKindPreferenceSchema = z.enum(["samples", "datasets"])
export const homeRecentScopePreferenceSchema = z.enum(["all", "mine"])
export const labelPrinterPreferenceSchema = printerIdSchema
export const directorySortFieldSchema = z.enum([
  "name",
  "created",
  "updated",
  "activity",
])
export const dataSortPreferenceSchema = z
  .object({
    direction: sortDirectionSchema,
    sort: resourceSortSchema,
  })
  .strict()
export const directorySortPreferenceSchema = z
  .object({
    direction: sortDirectionSchema,
    sort: directorySortFieldSchema,
  })
  .strict()
const dataGroupByPreferenceSchema = z.object({
  samples: sampleFacetFieldSchema.optional().catch(undefined),
  datasets: datasetFacetFieldSchema.optional().catch(undefined),
})
const dataGroupByPatchSchema = z
  .object({
    samples: sampleFacetFieldSchema.nullable().optional(),
    datasets: datasetFacetFieldSchema.nullable().optional(),
  })
  .strict()
const defaultSortPreferenceSchema = z.object({
  data: dataSortPreferenceSchema.optional().catch(undefined),
  instruments: directorySortPreferenceSchema.optional().catch(undefined),
  projects: directorySortPreferenceSchema.optional().catch(undefined),
})
const defaultSortPatchSchema = z
  .object({
    data: dataSortPreferenceSchema.nullable().optional(),
    instruments: directorySortPreferenceSchema.nullable().optional(),
    projects: directorySortPreferenceSchema.nullable().optional(),
  })
  .strict()

export const accountPreferencesSchema = z.object({
  theme: themePreferenceSchema.optional().catch(undefined),
  default_record_kind: recordKindPreferenceSchema.optional().catch(undefined),
  record_recent_resources: z.boolean().optional().catch(undefined),
  hub: z
    .object({
      data_group_by: dataGroupByPreferenceSchema.optional().catch(undefined),
      default_sort: defaultSortPreferenceSchema.optional().catch(undefined),
      home_recent_scope: homeRecentScopePreferenceSchema
        .optional()
        .catch(undefined),
      label_printer: labelPrinterPreferenceSchema.optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
})

export const accountPreferencesPatchSchema = z
  .object({
    theme: themePreferenceSchema.nullable().optional(),
    default_record_kind: recordKindPreferenceSchema.nullable().optional(),
    record_recent_resources: z.boolean().nullable().optional(),
    hub: z
      .object({
        data_group_by: dataGroupByPatchSchema.nullable().optional(),
        default_sort: defaultSortPatchSchema.nullable().optional(),
        home_recent_scope: homeRecentScopePreferenceSchema
          .nullable()
          .optional(),
        label_printer: labelPrinterPreferenceSchema.nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "At least one preference change is required."
  )

export type ThemePreference = z.infer<typeof themePreferenceSchema>
export type RecordKindPreference = z.infer<typeof recordKindPreferenceSchema>
export type HomeRecentScopePreference = z.infer<
  typeof homeRecentScopePreferenceSchema
>
export type DirectorySortField = z.infer<typeof directorySortFieldSchema>
export type DataSortPreference = z.infer<typeof dataSortPreferenceSchema>
export type DirectorySortPreference = z.infer<
  typeof directorySortPreferenceSchema
>
export type AccountPreferences = z.infer<typeof accountPreferencesSchema>
export type AccountPreferencesPatch = z.infer<
  typeof accountPreferencesPatchSchema
>

export type AccountPreferencesDocument = {
  etag: string
  preferences: AccountPreferences
  revision: number
  updatedAt: string | null
}

export type AccountPreferencesUpdate = {
  document: AccountPreferencesDocument
  state: "saved" | "changed"
}

type JsonObject = { [key: string]: unknown }

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function applyMergePatch(target: unknown, patch: unknown): unknown {
  if (!isJsonObject(patch)) return patch
  const result: JsonObject = isJsonObject(target) ? { ...target } : {}
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key]
    else result[key] = applyMergePatch(result[key], value)
  }
  return result
}
