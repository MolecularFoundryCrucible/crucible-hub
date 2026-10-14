import { z } from "zod"

import { datasetFacetFieldSchema, sampleFacetFieldSchema } from "./facets"

export const themePreferenceSchema = z.enum(["system", "light", "dark"])
export const recordKindPreferenceSchema = z.enum(["samples", "datasets"])
export const homeRecentScopePreferenceSchema = z.enum(["all", "mine"])
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

export const accountPreferencesSchema = z.object({
  theme: themePreferenceSchema.optional().catch(undefined),
  default_record_kind: recordKindPreferenceSchema.optional().catch(undefined),
  record_recent_resources: z.boolean().optional().catch(undefined),
  hub: z
    .object({
      data_group_by: dataGroupByPreferenceSchema.optional().catch(undefined),
      home_recent_scope: homeRecentScopePreferenceSchema
        .optional()
        .catch(undefined),
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
        home_recent_scope: homeRecentScopePreferenceSchema
          .nullable()
          .optional(),
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
