import { z } from "zod"

import {
  collectionFiltersSchema,
  normalizeCollectionFilters,
} from "@/data/crucible/collection-filters"
import type { CollectionFilters } from "@/data/crucible/collection-filters"

const instrumentMfidSchema = z
  .string()
  .min(1, "Choose an acquisition instrument or clear the filter.")
  .max(255, "The acquisition instrument identifier is too long.")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "The acquisition instrument identifier is not valid."
  )
  .optional()

export type ProjectDataFilterSearch = {
  createdFrom?: string
  createdTo?: string
  instrumentMfid?: string
  visibility?: string
}

export type ProjectDataCollectionFilters = CollectionFilters & {
  instrumentMfid?: string
}

export type ProjectDataFilterError = {
  field: keyof ProjectDataFilterSearch
  message: string
}

export type ProjectDataFilterResolution =
  | { filters: ProjectDataCollectionFilters; valid: true }
  | { errors: readonly ProjectDataFilterError[]; valid: false }

export function resolveProjectDataFilters(
  search: ProjectDataFilterSearch,
  kind: "datasets" | "samples"
): ProjectDataFilterResolution {
  const collection = collectionFiltersSchema.safeParse({
    createdFrom: search.createdFrom,
    createdTo: search.createdTo,
    visibility: search.visibility,
  })
  const instrument = instrumentMfidSchema.safeParse(search.instrumentMfid)
  const issues = [
    ...(collection.success ? [] : collection.error.issues),
    ...(instrument.success ? [] : instrument.error.issues),
  ]
  if (kind === "samples" && search.instrumentMfid !== undefined) {
    issues.push({
      code: "custom",
      message: "Acquisition instrument filters apply only to datasets.",
      path: ["instrumentMfid"],
    })
  }
  if (issues.length) {
    return {
      errors: issues.map((issue) => ({
        field: issue.path[0] as keyof ProjectDataFilterSearch,
        message: issue.message,
      })),
      valid: false,
    }
  }

  return {
    filters: {
      ...normalizeCollectionFilters(collection.data),
      ...(kind === "datasets" && instrument.data
        ? { instrumentMfid: instrument.data }
        : {}),
    },
    valid: true,
  }
}
