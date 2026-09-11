import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import {
  DatasetFacetFilter,
  SampleFacetFilter,
} from "@/components/crucible/collection-facet-filter"
import type { FacetSelection } from "@/components/crucible/collection-facet-filter"
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
import type { ProjectScope } from "@/data/crucible/data.queries"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"

import type { ProjectDataKind } from "./project-data-collection"
import { resolveProjectDataFilters } from "./project-data-filter-state"
import type {
  ProjectDataFilterError,
  ProjectDataFilterSearch,
} from "./project-data-filter-state"

type ProjectDataFilterDraft = ProjectDataFilterSearch & {
  projectScope: ProjectScope
}

export function ProjectDataFilters({
  errors,
  kind,
  projectMfid,
  projectScope,
  values,
}: {
  errors: readonly ProjectDataFilterError[]
  kind: ProjectDataKind
  projectMfid: string
  projectScope: ProjectScope
  values: ProjectDataFilterSearch
}) {
  const navigate = useNavigate({ from: "/projects/$projectMfid" })
  const [draft, setDraft] = useState<ProjectDataFilterDraft>({
    ...values,
    projectScope,
  })
  const [draftErrors, setDraftErrors] =
    useState<readonly ProjectDataFilterError[]>(errors)
  const [filtersOpen, setFiltersOpen] = useState(errors.length > 0)
  const [instrumentName, setInstrumentName] = useState<string>()
  const resolution = resolveProjectDataFilters(values, kind)
  const activeInstrumentMfid =
    resolution.valid && kind === "datasets"
      ? resolution.filters.instrumentMfid
      : undefined
  const scope = useWorkspaceScope()
  const instrumentResult = useQuery({
    ...resourceQueryOptions(scope, activeInstrumentMfid ?? ""),
    enabled: Boolean(activeInstrumentMfid),
  })
  const resolvedInstrument =
    instrumentResult.data?.kind === "instrument"
      ? instrumentResult.data.name
      : undefined
  const errorKey = JSON.stringify(errors)
  const hasErrors = errors.length > 0
  const valuesKey = JSON.stringify(values)

  useEffect(() => {
    setDraft({
      ...(JSON.parse(valuesKey) as ProjectDataFilterSearch),
      projectScope,
    })
    setDraftErrors(errorKey ? JSON.parse(errorKey) : [])
    setInstrumentName(undefined)
    if (hasErrors) setFiltersOpen(true)
  }, [errorKey, hasErrors, projectScope, valuesKey])

  const active = [
    projectScope !== "all"
      ? `Relationship to this project: ${capitalize(projectScope)}`
      : undefined,
    values.visibility && values.visibility !== "all"
      ? `Visibility: ${capitalize(values.visibility)}`
      : undefined,
    values.createdFrom
      ? `Created from (UTC): ${values.createdFrom}`
      : undefined,
    values.createdTo ? `Created to (UTC): ${values.createdTo}` : undefined,
    activeInstrumentMfid
      ? `Instrument: ${resolvedInstrument ?? activeInstrumentMfid}`
      : undefined,
    resolution.valid
      ? facetSummary(
          "Sample type",
          resolution.filters.sampleType,
          resolution.filters.sampleTypeIsNull
        )
      : undefined,
    resolution.valid
      ? facetSummary(
          "Measurement",
          resolution.filters.measurement,
          resolution.filters.measurementIsNull
        )
      : undefined,
    resolution.valid
      ? facetSummary(
          "Session",
          resolution.filters.sessionName,
          resolution.filters.sessionNameIsNull
        )
      : undefined,
    resolution.valid
      ? facetSummary(
          "Data format",
          resolution.filters.dataFormat,
          resolution.filters.dataFormatIsNull
        )
      : undefined,
    resolution.valid && resolution.filters.sort
      ? `Order: ${sortLabel(resolution.filters.sort)} (${resolution.filters.direction === "asc" ? "ascending" : "descending"})`
      : undefined,
  ].filter((value): value is string => Boolean(value))
  const invalid = (field: keyof ProjectDataFilterSearch) =>
    draftErrors.some((error) => error.field === field)
  const errorDescription = draftErrors.length
    ? "project-data-filter-errors"
    : undefined

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = resolveProjectDataFilters(draft, kind)
    if (!next.valid) {
      setDraftErrors(next.errors)
      return
    }
    setDraftErrors([])
    void navigate({
      params: { projectMfid },
      search: (previous) => ({
        ...previous,
        createdFrom: next.filters.createdFrom,
        createdTo: next.filters.createdTo,
        dataFormat: next.filters.dataFormat,
        dataFormatIsNull: next.filters.dataFormatIsNull,
        dataFormatSet: next.filters.dataFormat !== undefined || undefined,
        datasetCursor: undefined,
        direction: next.filters.direction,
        instrumentMfid:
          kind === "datasets" ? next.filters.instrumentMfid : undefined,
        measurement: next.filters.measurement,
        measurementIsNull: next.filters.measurementIsNull,
        measurementSet: next.filters.measurement !== undefined || undefined,
        preview: undefined,
        sampleCursor: undefined,
        sampleType: next.filters.sampleType,
        sampleTypeIsNull: next.filters.sampleTypeIsNull,
        sampleTypeSet: next.filters.sampleType !== undefined || undefined,
        scope: draft.projectScope === "all" ? undefined : draft.projectScope,
        sessionName: next.filters.sessionName,
        sessionNameIsNull: next.filters.sessionNameIsNull,
        sessionNameSet: next.filters.sessionName !== undefined || undefined,
        sort: next.filters.sort,
        visibility: next.filters.visibility,
      }),
      state: {},
      to: "/projects/$projectMfid",
    })
  }

  function clear() {
    setDraft({ projectScope: "all" })
    setDraftErrors([])
    setInstrumentName(undefined)
    void navigate({
      params: { projectMfid },
      search: (previous) => ({
        ...previous,
        createdFrom: undefined,
        createdTo: undefined,
        dataFormat: undefined,
        dataFormatIsNull: undefined,
        dataFormatSet: undefined,
        datasetCursor: undefined,
        direction: undefined,
        instrumentMfid: undefined,
        measurement: undefined,
        measurementIsNull: undefined,
        measurementSet: undefined,
        preview: undefined,
        sampleCursor: undefined,
        sampleType: undefined,
        sampleTypeIsNull: undefined,
        sampleTypeSet: undefined,
        scope: undefined,
        sessionName: undefined,
        sessionNameIsNull: undefined,
        sessionNameSet: undefined,
        sort: undefined,
        visibility: undefined,
      }),
      state: {},
      to: "/projects/$projectMfid",
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
          <FieldLegend className="sr-only">Project data filters</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="project-data-relationship">
                Relationship to this project
              </FieldLabel>
              <NativeSelect
                className="w-full"
                id="project-data-relationship"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    projectScope:
                      event.target.value === "assigned" ||
                      event.target.value === "shared"
                        ? event.target.value
                        : "all",
                  }))
                }
                value={draft.projectScope}
              >
                <NativeSelectOption value="all">All</NativeSelectOption>
                <NativeSelectOption value="assigned">
                  Assigned
                </NativeSelectOption>
                <NativeSelectOption value="shared">Shared</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field data-invalid={invalid("visibility")}>
              <FieldLabel htmlFor="project-data-visibility">
                Visibility
              </FieldLabel>
              <NativeSelect
                aria-describedby={
                  invalid("visibility") ? errorDescription : undefined
                }
                aria-invalid={invalid("visibility") || undefined}
                className="w-full"
                id="project-data-visibility"
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
            {kind === "samples" && resolution.valid ? (
              <SampleFacetFilter
                enabled={filtersOpen}
                field="sample_type"
                filters={{
                  ...resolution.filters,
                  projectMfid,
                  projectScope,
                }}
                id="project-data-sample-type"
                label="Sample type"
                onChange={(selection) =>
                  setDraft((current) =>
                    setFacetDraft(
                      current,
                      "sampleType",
                      "sampleTypeSet",
                      "sampleTypeIsNull",
                      selection
                    )
                  )
                }
                selection={facetSelection(
                  draft.sampleType,
                  draft.sampleTypeSet,
                  draft.sampleTypeIsNull
                )}
              />
            ) : null}
            {kind === "datasets" && resolution.valid ? (
              <>
                <DatasetFacetFilter
                  enabled={filtersOpen}
                  field="measurement"
                  filters={{
                    ...resolution.filters,
                    projectMfid,
                    projectScope,
                  }}
                  id="project-data-measurement"
                  label="Measurement"
                  onChange={(selection) =>
                    setDraft((current) =>
                      setFacetDraft(
                        current,
                        "measurement",
                        "measurementSet",
                        "measurementIsNull",
                        selection
                      )
                    )
                  }
                  selection={facetSelection(
                    draft.measurement,
                    draft.measurementSet,
                    draft.measurementIsNull
                  )}
                />
                <DatasetFacetFilter
                  enabled={filtersOpen}
                  field="session"
                  filters={{
                    ...resolution.filters,
                    projectMfid,
                    projectScope,
                  }}
                  id="project-data-session"
                  label="Session"
                  onChange={(selection) =>
                    setDraft((current) =>
                      setFacetDraft(
                        current,
                        "sessionName",
                        "sessionNameSet",
                        "sessionNameIsNull",
                        selection
                      )
                    )
                  }
                  selection={facetSelection(
                    draft.sessionName,
                    draft.sessionNameSet,
                    draft.sessionNameIsNull
                  )}
                />
                <DatasetFacetFilter
                  enabled={filtersOpen}
                  field="data_format"
                  filters={{
                    ...resolution.filters,
                    projectMfid,
                    projectScope,
                  }}
                  id="project-data-format"
                  label="Data format"
                  onChange={(selection) =>
                    setDraft((current) =>
                      setFacetDraft(
                        current,
                        "dataFormat",
                        "dataFormatSet",
                        "dataFormatIsNull",
                        selection
                      )
                    )
                  }
                  selection={facetSelection(
                    draft.dataFormat,
                    draft.dataFormatSet,
                    draft.dataFormatIsNull
                  )}
                />
              </>
            ) : null}
            <Field data-invalid={invalid("createdFrom")}>
              <FieldLabel htmlFor="project-data-created-from">
                Created from (UTC)
              </FieldLabel>
              <Input
                aria-describedby={
                  invalid("createdFrom") ? errorDescription : undefined
                }
                aria-invalid={invalid("createdFrom") || undefined}
                id="project-data-created-from"
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
              <FieldLabel htmlFor="project-data-created-to">
                Created to (UTC)
              </FieldLabel>
              <Input
                aria-describedby={
                  invalid("createdTo") ? errorDescription : undefined
                }
                aria-invalid={invalid("createdTo") || undefined}
                id="project-data-created-to"
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
                <FieldLabel htmlFor="project-data-instrument-trigger">
                  Acquisition instrument
                </FieldLabel>
                <InstrumentChooser
                  describedBy={
                    invalid("instrumentMfid") ? errorDescription : undefined
                  }
                  invalid={invalid("instrumentMfid")}
                  name={instrumentName ?? resolvedInstrument}
                  onChange={(instrument) => {
                    setDraft((current) => ({
                      ...current,
                      instrumentMfid: instrument?.mfid,
                    }))
                    setInstrumentName(instrument?.name)
                  }}
                  value={draft.instrumentMfid}
                />
              </Field>
            ) : null}
            <Field data-invalid={invalid("sort")}>
              <FieldLabel htmlFor="project-data-sort">Order by</FieldLabel>
              <NativeSelect
                aria-describedby={
                  invalid("sort") ? errorDescription : undefined
                }
                aria-invalid={invalid("sort") || undefined}
                className="w-full"
                id="project-data-sort"
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
                <NativeSelectOption value="created">Created</NativeSelectOption>
                <NativeSelectOption value="updated">Updated</NativeSelectOption>
              </NativeSelect>
            </Field>
            {draft.sort ? (
              <Field data-invalid={invalid("direction")}>
                <FieldLabel htmlFor="project-data-direction">
                  Direction
                </FieldLabel>
                <NativeSelect
                  aria-describedby={
                    invalid("direction") ? errorDescription : undefined
                  }
                  aria-invalid={invalid("direction") || undefined}
                  className="w-full"
                  id="project-data-direction"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      direction: event.target.value,
                    }))
                  }
                  value={draft.direction ?? "desc"}
                >
                  <NativeSelectOption value="asc">Ascending</NativeSelectOption>
                  <NativeSelectOption value="desc">
                    Descending
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
            ) : null}
          </FieldGroup>
        </FieldSet>
        {draftErrors.length ? (
          <FieldError
            id="project-data-filter-errors"
            errors={[...draftErrors]}
          />
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

function InstrumentChooser({
  describedBy,
  invalid,
  name,
  onChange,
  value,
}: {
  describedBy: string | undefined
  invalid: boolean
  name: string | undefined
  onChange: (instrument: { mfid: string; name: string } | undefined) => void
  value: string | undefined
}) {
  return (
    <ResourceChooser
      describedBy={describedBy}
      emptyLabel="All instruments"
      invalid={invalid}
      kind="instrument"
      onChange={(instrument) =>
        onChange(
          instrument
            ? { mfid: instrument.unique_id, name: instrument.name }
            : undefined
        )
      }
      triggerId="project-data-instrument-trigger"
      value={
        value
          ? {
              context: null,
              kind: "instrument",
              name: name ?? value,
              unique_id: value,
            }
          : undefined
      }
    />
  )
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function facetSummary(
  label: string,
  value: string | undefined,
  isNull: true | undefined
) {
  if (isNull) return `${label}: Unspecified`
  if (value === undefined) return undefined
  return `${label}: ${value || "Empty value"}`
}

function facetSelection(
  value: string | undefined,
  selected: true | undefined,
  isNull: true | undefined
): FacetSelection {
  if (isNull) return { kind: "null" }
  return selected ? { kind: "value", value: value ?? "" } : { kind: "all" }
}

function setFacetDraft(
  filters: ProjectDataFilterDraft,
  valueKey: "dataFormat" | "measurement" | "sampleType" | "sessionName",
  selectedKey:
    "dataFormatSet" | "measurementSet" | "sampleTypeSet" | "sessionNameSet",
  nullKey:
    | "dataFormatIsNull"
    | "measurementIsNull"
    | "sampleTypeIsNull"
    | "sessionNameIsNull",
  selection: FacetSelection
): ProjectDataFilterDraft {
  return {
    ...filters,
    [nullKey]: selection.kind === "null" || undefined,
    [selectedKey]: selection.kind === "value" || undefined,
    [valueKey]: selection.kind === "value" ? selection.value : undefined,
  }
}

function sortLabel(sort: string) {
  if (sort === "created") return "Created"
  if (sort === "updated") return "Updated"
  return "Name"
}
