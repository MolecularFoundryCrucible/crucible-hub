import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { ResourceChooser } from "@/components/crucible/resource-chooser"
import { CollectionFilterPanel } from "@/components/crucible/collection-filter-panel"
import {
  CollectionCreatedRangeFields,
  CollectionOrderFields,
} from "@/components/crucible/collection-query-fields"
import {
  DatasetFacetFilter,
  SampleFacetFilter,
} from "@/components/crucible/collection-facet-filter"
import type { FacetSelection } from "@/components/crucible/collection-facet-filter"
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { personQueryOptions } from "@/data/crucible/people.queries"
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
  const scope = useWorkspaceScope()
  const resolution = resolveDataFilters(values)
  const activeProjectMfid = resolution.valid
    ? resolution.filters.projectMfid
    : undefined
  const activeInstrumentMfid =
    resolution.valid && resolution.filters.kind === "datasets"
      ? resolution.filters.instrumentMfid
      : undefined
  const activeOwnerId = resolution.valid
    ? resolution.filters.ownerId
    : undefined
  const projectResult = useQuery({
    ...projectQueryOptions(scope, activeProjectMfid ?? ""),
    enabled: Boolean(activeProjectMfid),
  })
  const instrumentResult = useQuery({
    ...resourceQueryOptions(scope, activeInstrumentMfid ?? ""),
    enabled: Boolean(activeInstrumentMfid),
  })
  const ownerResult = useQuery({
    ...personQueryOptions(scope, activeOwnerId ?? ""),
    enabled: Boolean(activeOwnerId),
  })
  const resolvedProjectName = projectResult.data
    ? (projectResult.data.title ?? projectResult.data.project_id)
    : undefined
  const resolvedInstrumentName =
    instrumentResult.data?.kind === "instrument"
      ? instrumentResult.data.name
      : undefined
  const resolvedOwnerName = ownerResult.data
    ? `${ownerResult.data.first_name} ${ownerResult.data.last_name}`.trim()
    : undefined
  const errorKey = JSON.stringify(errors)
  const hasErrors = errors.length > 0
  const valuesKey = JSON.stringify(filterDraft(values))

  useEffect(() => {
    setDraft(JSON.parse(valuesKey) as DataFilterSearch)
    setDraftErrors(errorKey ? JSON.parse(errorKey) : [])
    setProjectName(undefined)
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
        resolution.filters.ownerIdIsNull
          ? "Owner: Unspecified"
          : activeOwnerId
            ? `Owner: ${resolvedOwnerName ?? activeOwnerId}`
            : undefined,
        facetSummary(
          "Sample type",
          resolution.filters.sampleType,
          resolution.filters.sampleTypeIsNull
        ),
        facetSummary(
          "Measurement",
          resolution.filters.measurement,
          resolution.filters.measurementIsNull
        ),
        facetSummary(
          "Session",
          resolution.filters.sessionName,
          resolution.filters.sessionNameIsNull
        ),
        facetSummary(
          "Data format",
          resolution.filters.dataFormat,
          resolution.filters.dataFormatIsNull
        ),
        resolution.filters.createdFrom
          ? `Created from (UTC): ${resolution.filters.createdFrom}`
          : undefined,
        resolution.filters.createdTo
          ? `Created to (UTC): ${resolution.filters.createdTo}`
          : undefined,
        resolution.filters.instrumentMfidIsNull
          ? "Instrument: Unspecified"
          : activeInstrumentMfid
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
  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = resolveDataFilters({ ...values, ...draft })
    if (!next.valid) {
      setDraftErrors(next.errors)
      return
    }
    setDraftErrors([])
    setFiltersOpen(false)
    void navigate({
      search: (previous) => applyDataFilters(previous, next.filters),
      state: {},
      to: "/data",
    })
  }

  function clear() {
    setDraft({ kind: kind === "samples" ? undefined : kind })
    setDraftErrors([])
    setProjectName(undefined)
    void navigate({
      search: (previous) => clearDataFilters(previous),
      state: {},
      to: "/data",
    })
  }

  return (
    <CollectionFilterPanel
      activeFilters={active}
      footer={
        <>
          <Button onClick={clear} type="button" variant="outline">
            Clear filters
          </Button>
          <Button form="data-filters" type="submit">
            Apply filters
          </Button>
        </>
      }
      onOpenChange={setFiltersOpen}
      open={filtersOpen}
      title="Data filters"
    >
      <form className="flex flex-col gap-4" id="data-filters" onSubmit={apply}>
        <FieldSet>
          <FieldLegend className="sr-only">Data filters</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
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
            {kind === "samples" && resolution.valid ? (
              <SampleFacetFilter
                enabled={filtersOpen}
                field="owner"
                filters={resolution.filters}
                id="data-owner"
                label="Owner"
                onChange={(selection) =>
                  setDraft((current) =>
                    setFacetDraft(
                      current,
                      "ownerId",
                      "ownerIdSet",
                      "ownerIdIsNull",
                      selection
                    )
                  )
                }
                selection={facetSelection(
                  draft.ownerId,
                  draft.ownerIdSet,
                  draft.ownerIdIsNull
                )}
              />
            ) : kind === "datasets" && resolution.valid ? (
              <DatasetFacetFilter
                enabled={filtersOpen}
                field="owner"
                filters={resolution.filters}
                id="data-owner"
                label="Owner"
                onChange={(selection) =>
                  setDraft((current) =>
                    setFacetDraft(
                      current,
                      "ownerId",
                      "ownerIdSet",
                      "ownerIdIsNull",
                      selection
                    )
                  )
                }
                selection={facetSelection(
                  draft.ownerId,
                  draft.ownerIdSet,
                  draft.ownerIdIsNull
                )}
              />
            ) : null}
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
            {kind === "samples" && resolution.valid ? (
              <SampleFacetFilter
                enabled={filtersOpen}
                field="sample_type"
                filters={resolution.filters}
                id="data-sample-type"
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
                  filters={resolution.filters}
                  id="data-measurement"
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
                  filters={resolution.filters}
                  id="data-session"
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
                  filters={resolution.filters}
                  id="data-format"
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
            <CollectionCreatedRangeFields
              describedBy={errorDescription}
              idPrefix="data"
              invalid={invalid}
              onChange={(field, value) =>
                setDraft((current) => ({ ...current, [field]: value }))
              }
              value={draft}
            />
            {kind === "datasets" && resolution.valid ? (
              <DatasetFacetFilter
                enabled={filtersOpen}
                field="instrument"
                filters={resolution.filters}
                id="data-instrument"
                label="Acquisition instrument"
                onChange={(selection) => {
                  setDraft((current) => ({
                    ...current,
                    instrumentMfid:
                      selection.kind === "value" ? selection.value : undefined,
                    instrumentMfidIsNull:
                      selection.kind === "null" || undefined,
                  }))
                }}
                selection={
                  draft.instrumentMfidIsNull
                    ? { kind: "null" }
                    : draft.instrumentMfid
                      ? { kind: "value", value: draft.instrumentMfid }
                      : { kind: "all" }
                }
              />
            ) : null}
            <CollectionOrderFields
              describedBy={errorDescription}
              idPrefix="data"
              invalid={invalid}
              onChange={(value) =>
                setDraft((current) => ({ ...current, ...value }))
              }
              value={draft}
            />
          </FieldGroup>
        </FieldSet>
        {draftErrors.length ? (
          <FieldError id="data-filter-errors" errors={[...draftErrors]} />
        ) : null}
      </form>
    </CollectionFilterPanel>
  )
}

function filterDraft(values: DataSearch): DataFilterSearch {
  return {
    affiliation: values.affiliation,
    createdFrom: values.createdFrom,
    createdTo: values.createdTo,
    dataFormat: values.dataFormat,
    dataFormatIsNull: values.dataFormatIsNull,
    dataFormatSet: values.dataFormatSet,
    direction: values.direction,
    instrumentMfid: values.instrumentMfid,
    instrumentMfidIsNull: values.instrumentMfidIsNull,
    kind: values.kind,
    measurement: values.measurement,
    measurementIsNull: values.measurementIsNull,
    measurementSet: values.measurementSet,
    ownerId: values.ownerId,
    ownerIdIsNull: values.ownerIdIsNull,
    ownerIdSet: values.ownerIdSet,
    projectMfid: values.projectMfid,
    projectScope: values.projectScope,
    sampleType: values.sampleType,
    sampleTypeIsNull: values.sampleTypeIsNull,
    sampleTypeSet: values.sampleTypeSet,
    sessionName: values.sessionName,
    sessionNameIsNull: values.sessionNameIsNull,
    sessionNameSet: values.sessionNameSet,
    sort: values.sort,
    visibility: values.visibility,
  }
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
  filters: DataFilterSearch,
  valueKey:
    "dataFormat" | "measurement" | "ownerId" | "sampleType" | "sessionName",
  selectedKey:
    | "dataFormatSet"
    | "measurementSet"
    | "ownerIdSet"
    | "sampleTypeSet"
    | "sessionNameSet",
  nullKey:
    | "dataFormatIsNull"
    | "measurementIsNull"
    | "ownerIdIsNull"
    | "sampleTypeIsNull"
    | "sessionNameIsNull",
  selection: FacetSelection
): DataFilterSearch {
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

function dataKind(kind: string | undefined): DataKindFilter {
  return kind === "datasets" ? "datasets" : "samples"
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
