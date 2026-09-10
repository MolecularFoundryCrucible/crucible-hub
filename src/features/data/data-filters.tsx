import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { ResourceChooser } from "@/components/crucible/resource-chooser"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import type { WorkspaceSearchResult } from "@/data/crucible/workspace-source"

import {
  applyDataFilters,
  clearDataFilters,
  resolveDataFilters,
  setDataFilterProject,
} from "./data-filter-state"
import type {
  DataFilterError,
  DataFilterSearch,
  DataKindFilter,
  DataSearch,
} from "./data-filter-state"

export function DataFilters({
  errors,
  values,
}: {
  errors: readonly DataFilterError[]
  values: DataSearch
}) {
  const navigate = useNavigate({ from: "/data" })
  const kind = dataKind(values.kind)
  const [draft, setDraft] = useState<DataFilterSearch>(() =>
    filterDraft(values)
  )
  const [draftErrors, setDraftErrors] =
    useState<readonly DataFilterError[]>(errors)
  const [filtersOpen, setFiltersOpen] = useState(errors.length > 0)
  const [projectName, setProjectName] = useState<string>()
  const [instrumentName, setInstrumentName] = useState<string>()
  const scope = useWorkspaceScope()
  const resolution = resolveDataFilters(values)
  const activeProjectMfid = resolution.valid
    ? resolution.filters.projectMfid
    : undefined
  const activeInstrumentMfid =
    resolution.valid && resolution.filters.kind === "datasets"
      ? resolution.filters.instrumentMfid
      : undefined
  const projectResult = useQuery({
    ...projectQueryOptions(scope, activeProjectMfid ?? ""),
    enabled: Boolean(activeProjectMfid),
  })
  const instrumentResult = useQuery({
    ...resourceQueryOptions(scope, activeInstrumentMfid ?? ""),
    enabled: Boolean(activeInstrumentMfid),
  })
  const resolvedProjectName = projectResult.data
    ? (projectResult.data.title ?? projectResult.data.project_id)
    : undefined
  const resolvedInstrumentName =
    instrumentResult.data?.kind === "instrument"
      ? instrumentResult.data.name
      : undefined
  const errorKey = JSON.stringify(errors)
  const hasErrors = errors.length > 0
  const valuesKey = JSON.stringify(filterDraft(values))

  useEffect(() => {
    setDraft(JSON.parse(valuesKey) as DataFilterSearch)
    setDraftErrors(errorKey ? JSON.parse(errorKey) : [])
    setProjectName(undefined)
    setInstrumentName(undefined)
    if (hasErrors) setFiltersOpen(true)
  }, [errorKey, hasErrors, valuesKey])

  const active = resolution.valid
    ? [
        resolution.filters.affiliation ? "Ownership: Owned by me" : undefined,
        resolution.filters.projectMfid
          ? `Project: ${resolvedProjectName ?? resolution.filters.projectMfid}`
          : undefined,
        resolution.filters.projectMfid &&
        resolution.filters.projectScope !== "all"
          ? `Relationship: ${capitalize(resolution.filters.projectScope)}`
          : undefined,
        resolution.filters.visibility
          ? `Visibility: ${capitalize(resolution.filters.visibility)}`
          : undefined,
        resolution.filters.createdFrom
          ? `Created from (UTC): ${resolution.filters.createdFrom}`
          : undefined,
        resolution.filters.createdTo
          ? `Created to (UTC): ${resolution.filters.createdTo}`
          : undefined,
        activeInstrumentMfid
          ? `Instrument: ${resolvedInstrumentName ?? activeInstrumentMfid}`
          : undefined,
        resolution.filters.sort
          ? `Order: ${sortLabel(resolution.filters.sort)} (${resolution.filters.direction === "asc" ? "ascending" : "descending"})`
          : undefined,
      ].filter((value): value is string => Boolean(value))
    : []
  const invalid = (field: keyof DataFilterSearch) =>
    draftErrors.some((error) => error.field === field)
  const errorDescription = draftErrors.length ? "data-filter-errors" : undefined
  const selectedProject = draft.projectMfid
    ? chooserValue(
        "project",
        draft.projectMfid,
        projectName ??
          (draft.projectMfid === activeProjectMfid
            ? resolvedProjectName
            : undefined)
      )
    : undefined
  const selectedInstrument = draft.instrumentMfid
    ? chooserValue(
        "instrument",
        draft.instrumentMfid,
        instrumentName ??
          (draft.instrumentMfid === activeInstrumentMfid
            ? resolvedInstrumentName
            : undefined)
      )
    : undefined

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = resolveDataFilters({ ...values, ...draft })
    if (!next.valid) {
      setDraftErrors(next.errors)
      return
    }
    setDraftErrors([])
    void navigate({
      search: (previous) => applyDataFilters(previous, next.filters),
      state: {},
      to: "/data",
    })
  }

  function clear() {
    setDraft({ kind: kind === "all" ? undefined : kind })
    setDraftErrors([])
    setProjectName(undefined)
    setInstrumentName(undefined)
    void navigate({
      search: (previous) => clearDataFilters(previous),
      state: {},
      to: "/data",
    })
  }

  return (
    <details
      className="rounded-lg border p-4"
      onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
      open={filtersOpen}
    >
      <summary className="cursor-pointer text-label">
        Filters
        {active.length ? (
          <span className="ml-2 text-supporting break-all text-muted-foreground">
            {active.join("; ")}
          </span>
        ) : null}
      </summary>
      <form className="mt-4 flex flex-col gap-4" onSubmit={apply}>
        <FieldSet>
          <FieldLegend className="sr-only">Data filters</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field data-invalid={invalid("projectMfid")}>
              <FieldLabel htmlFor="data-project-trigger">Project</FieldLabel>
              <ResourceChooser
                describedBy={
                  invalid("projectMfid") ? errorDescription : undefined
                }
                invalid={invalid("projectMfid")}
                kind="project"
                onChange={(project) => {
                  setDraft((current) =>
                    setDataFilterProject(current, project?.unique_id)
                  )
                  setProjectName(project?.name)
                }}
                triggerId="data-project-trigger"
                value={selectedProject}
              />
            </Field>
            <Field data-invalid={invalid("affiliation")}>
              <FieldLabel htmlFor="data-affiliation">Ownership</FieldLabel>
              <NativeSelect
                aria-describedby={
                  invalid("affiliation") ? errorDescription : undefined
                }
                aria-invalid={invalid("affiliation") || undefined}
                className="w-full"
                id="data-affiliation"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    affiliation: event.target.value || undefined,
                  }))
                }
                value={draft.affiliation ?? ""}
              >
                <NativeSelectOption value="">All accessible</NativeSelectOption>
                <NativeSelectOption value="owner">
                  Owned by me
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            {draft.projectMfid ? (
              <Field data-invalid={invalid("projectScope")}>
                <FieldLabel htmlFor="data-project-relationship">
                  Relationship to this project
                </FieldLabel>
                <NativeSelect
                  aria-describedby={
                    invalid("projectScope") ? errorDescription : undefined
                  }
                  aria-invalid={invalid("projectScope") || undefined}
                  className="w-full"
                  id="data-project-relationship"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      projectScope: event.target.value,
                    }))
                  }
                  value={draft.projectScope ?? "all"}
                >
                  <NativeSelectOption value="all">All</NativeSelectOption>
                  <NativeSelectOption value="assigned">
                    Assigned
                  </NativeSelectOption>
                  <NativeSelectOption value="shared">Shared</NativeSelectOption>
                </NativeSelect>
              </Field>
            ) : null}
            <Field data-invalid={invalid("visibility")}>
              <FieldLabel htmlFor="data-visibility">Visibility</FieldLabel>
              <NativeSelect
                aria-describedby={
                  invalid("visibility") ? errorDescription : undefined
                }
                aria-invalid={invalid("visibility") || undefined}
                className="w-full"
                id="data-visibility"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    visibility: event.target.value,
                  }))
                }
                value={draft.visibility ?? "all"}
              >
                <NativeSelectOption value="all">All</NativeSelectOption>
                <NativeSelectOption value="public">Public</NativeSelectOption>
                <NativeSelectOption value="private">Private</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field data-invalid={invalid("createdFrom")}>
              <FieldLabel htmlFor="data-created-from">
                Created from (UTC)
              </FieldLabel>
              <Input
                aria-describedby={
                  invalid("createdFrom") ? errorDescription : undefined
                }
                aria-invalid={invalid("createdFrom") || undefined}
                id="data-created-from"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    createdFrom: event.target.value || undefined,
                  }))
                }
                type="date"
                value={draft.createdFrom ?? ""}
              />
            </Field>
            <Field data-invalid={invalid("createdTo")}>
              <FieldLabel htmlFor="data-created-to">
                Created to (UTC)
              </FieldLabel>
              <Input
                aria-describedby={
                  invalid("createdTo") ? errorDescription : undefined
                }
                aria-invalid={invalid("createdTo") || undefined}
                id="data-created-to"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    createdTo: event.target.value || undefined,
                  }))
                }
                type="date"
                value={draft.createdTo ?? ""}
              />
            </Field>
            {kind === "datasets" ? (
              <Field data-invalid={invalid("instrumentMfid")}>
                <FieldLabel htmlFor="data-instrument-trigger">
                  Acquisition instrument
                </FieldLabel>
                <ResourceChooser
                  describedBy={
                    invalid("instrumentMfid") ? errorDescription : undefined
                  }
                  invalid={invalid("instrumentMfid")}
                  kind="instrument"
                  onChange={(instrument) => {
                    setDraft((current) => ({
                      ...current,
                      instrumentMfid: instrument?.unique_id,
                    }))
                    setInstrumentName(instrument?.name)
                  }}
                  triggerId="data-instrument-trigger"
                  value={selectedInstrument}
                />
              </Field>
            ) : null}
            {kind !== "all" ? (
              <>
                <Field data-invalid={invalid("sort")}>
                  <FieldLabel htmlFor="data-sort">Order by</FieldLabel>
                  <NativeSelect
                    aria-describedby={
                      invalid("sort") ? errorDescription : undefined
                    }
                    aria-invalid={invalid("sort") || undefined}
                    className="w-full"
                    id="data-sort"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        direction: event.target.value
                          ? (current.direction ?? "desc")
                          : undefined,
                        sort: event.target.value || undefined,
                      }))
                    }
                    value={draft.sort ?? ""}
                  >
                    <NativeSelectOption value="">Default</NativeSelectOption>
                    <NativeSelectOption value="name">Name</NativeSelectOption>
                    <NativeSelectOption value="created">
                      Created
                    </NativeSelectOption>
                    <NativeSelectOption value="updated">
                      Updated
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
                {draft.sort ? (
                  <Field data-invalid={invalid("direction")}>
                    <FieldLabel htmlFor="data-direction">Direction</FieldLabel>
                    <NativeSelect
                      aria-describedby={
                        invalid("direction") ? errorDescription : undefined
                      }
                      aria-invalid={invalid("direction") || undefined}
                      className="w-full"
                      id="data-direction"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          direction: event.target.value,
                        }))
                      }
                      value={draft.direction ?? "desc"}
                    >
                      <NativeSelectOption value="asc">
                        Ascending
                      </NativeSelectOption>
                      <NativeSelectOption value="desc">
                        Descending
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                ) : null}
              </>
            ) : null}
          </FieldGroup>
        </FieldSet>
        {draftErrors.length ? (
          <FieldError id="data-filter-errors" errors={[...draftErrors]} />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Apply filters</Button>
          <Button onClick={clear} type="button" variant="outline">
            Clear filters
          </Button>
        </div>
      </form>
    </details>
  )
}

function filterDraft(values: DataSearch): DataFilterSearch {
  return {
    affiliation: values.affiliation,
    createdFrom: values.createdFrom,
    createdTo: values.createdTo,
    direction: values.direction,
    instrumentMfid: values.instrumentMfid,
    kind: values.kind,
    projectMfid: values.projectMfid,
    projectScope: values.projectScope,
    sort: values.sort,
    visibility: values.visibility,
  }
}

function sortLabel(sort: string) {
  if (sort === "created") return "Created"
  if (sort === "updated") return "Updated"
  return "Name"
}

function dataKind(kind: string | undefined): DataKindFilter {
  return kind === "datasets" || kind === "samples" ? kind : "all"
}

function chooserValue(
  kind: "instrument" | "project",
  mfid: string,
  name: string | undefined
): WorkspaceSearchResult {
  return {
    context: null,
    kind,
    name: name ?? mfid,
    unique_id: mfid,
  }
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}
