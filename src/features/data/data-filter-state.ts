import { z } from "zod"

import {
  collectionFiltersSchema,
  normalizeCollectionFilters,
} from "@/data/crucible/collection-filters"
import type { CollectionFilters } from "@/data/crucible/collection-filters"
import type { ProjectScope } from "@/data/crucible/data.queries"

const filterSearchValue = z.string().max(255).optional().catch("")
const cursorSearchValue = z
  .string()
  .min(1)
  .max(2048)
  .optional()
  .catch(undefined)

export const dataSearchSchema = z.object({
  createdFrom: filterSearchValue,
  createdTo: filterSearchValue,
  datasetCursor: cursorSearchValue,
  instrumentMfid: filterSearchValue,
  kind: filterSearchValue,
  projectMfid: filterSearchValue,
  projectScope: filterSearchValue,
  sampleCursor: cursorSearchValue,
  visibility: filterSearchValue,
})

export type DataKind = "datasets" | "samples"
export type DataKindFilter = "all" | DataKind
export type DataSearch = z.infer<typeof dataSearchSchema>
export type DataFilterSearch = Omit<
  DataSearch,
  "datasetCursor" | "sampleCursor"
>

type ProjectSelection =
  | { projectMfid?: undefined; projectScope?: undefined }
  | { projectMfid: string; projectScope: ProjectScope }

export type DataFilterValues = CollectionFilters &
  ProjectSelection & {
    instrumentMfid?: string
    kind: DataKindFilter
  }

export type DataFilterField = keyof DataFilterSearch

export type DataFilterError = {
  field: DataFilterField
  message: string
}

export type DataFilterResolution =
  | { filters: DataFilterValues; valid: true }
  | { errors: readonly DataFilterError[]; valid: false }

const dataKindSchema = z.enum(["samples", "datasets"]).optional()
const projectScopeSchema = z.enum(["all", "assigned", "shared"]).optional()
const mfidSchema = z
  .string()
  .trim()
  .min(1, "Choose a resource or clear the filter.")
  .max(255, "The resource identifier is too long.")
  .regex(/^[a-zA-Z0-9_-]+$/, "The resource identifier is not valid.")
  .optional()

const domainFiltersSchema = z
  .object({
    instrumentMfid: mfidSchema,
    kind: dataKindSchema,
    projectMfid: mfidSchema,
    projectScope: projectScopeSchema,
  })
  .superRefine((filters, context) => {
    if (filters.projectScope && !filters.projectMfid) {
      context.addIssue({
        code: "custom",
        message: "Choose a project before selecting its relationship.",
        path: ["projectScope"],
      })
    }
    if (filters.instrumentMfid && filters.kind !== "datasets") {
      context.addIssue({
        code: "custom",
        message: "Acquisition instrument filters apply only to datasets.",
        path: ["instrumentMfid"],
      })
    }
  })

export function resolveDataFilters(search: DataSearch): DataFilterResolution {
  const collection = collectionFiltersSchema.safeParse({
    createdFrom: search.createdFrom,
    createdTo: search.createdTo,
    visibility: search.visibility,
  })
  const domain = domainFiltersSchema.safeParse({
    instrumentMfid: search.instrumentMfid,
    kind: search.kind,
    projectMfid: search.projectMfid,
    projectScope: search.projectScope,
  })
  if (!collection.success || !domain.success) {
    const issues = [
      ...(collection.success ? [] : collection.error.issues),
      ...(domain.success ? [] : domain.error.issues),
    ]
    return {
      errors: issues.map((issue) => ({
        field: dataFilterField(issue.path[0]),
        message: issue.message,
      })),
      valid: false,
    }
  }

  const projectSelection = domain.data.projectMfid
    ? {
        projectMfid: domain.data.projectMfid,
        projectScope: domain.data.projectScope ?? "all",
      }
    : {}
  const filters: DataFilterValues = {
    ...normalizeCollectionFilters(collection.data),
    ...projectSelection,
    ...(domain.data.kind === "datasets" && domain.data.instrumentMfid
      ? { instrumentMfid: domain.data.instrumentMfid }
      : {}),
    kind: domain.data.kind ?? "all",
  }

  return { filters, valid: true }
}

export function applyDataFilters(
  previous: Readonly<Record<string, unknown> & DataSearch>,
  filters: DataFilterValues
) {
  return {
    ...previous,
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
    datasetCursor: undefined,
    instrumentMfid:
      filters.kind === "datasets" ? filters.instrumentMfid : undefined,
    kind: filters.kind === "all" ? undefined : filters.kind,
    projectMfid: filters.projectMfid,
    projectScope:
      filters.projectScope === "all" ? undefined : filters.projectScope,
    preview: undefined,
    sampleCursor: undefined,
    visibility: filters.visibility,
  }
}

export function clearDataFilters(
  previous: Readonly<Record<string, unknown> & DataSearch>
) {
  return {
    ...previous,
    createdFrom: undefined,
    createdTo: undefined,
    datasetCursor: undefined,
    instrumentMfid: undefined,
    kind:
      previous.kind === "datasets" || previous.kind === "samples"
        ? previous.kind
        : undefined,
    projectMfid: undefined,
    projectScope: undefined,
    preview: undefined,
    sampleCursor: undefined,
    visibility: undefined,
  }
}

export function switchDataKind(
  previous: Readonly<Record<string, unknown> & DataSearch>,
  kind: DataKindFilter
) {
  return {
    ...previous,
    datasetCursor: undefined,
    instrumentMfid: kind === "datasets" ? previous.instrumentMfid : undefined,
    kind: kind === "all" ? undefined : kind,
    preview: undefined,
    sampleCursor: undefined,
  }
}

export function setDataFilterProject(
  filters: DataFilterSearch,
  projectMfid: string | undefined
): DataFilterSearch {
  const normalized = projectMfid?.trim() || undefined
  return {
    ...filters,
    projectMfid: normalized,
    projectScope: normalized ? filters.projectScope : undefined,
  }
}

function dataFilterField(field: PropertyKey | undefined): DataFilterField {
  switch (field) {
    case "createdFrom":
    case "createdTo":
    case "instrumentMfid":
    case "kind":
    case "projectMfid":
    case "projectScope":
    case "visibility":
      return field
    default:
      return "kind"
  }
}
