import { Checkbox } from "@/components/ui/checkbox"
import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import {
  publicDataFilterState,
  publicDataSearchValue,
} from "@/data/crucible/public-data"
import { useIncludePublicByDefault } from "@/features/preferences/public-data"
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import { ResourceChooser } from "@/components/crucible/resource-chooser"
import {
  collectionActiveFilter,
  collectionActiveFilters,
  CollectionFilterPanel,
  FilterChoice,
  FilterForm,
  FilterSection,
} from "@/components/crucible/collection-filter-panel"
import {
  DatasetFacetFilter,
  facetNullLabel,
  SampleFacetFilter,
} from "@/components/crucible/collection-facet-filter"
import {
  capitalize,
  facetSelection,
  facetSummary,
  setFacetDraft,
} from "@/data/crucible/filter-draft"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { defaultCollectionOrdering } from "@/data/crucible/collection-query"
import type { CollectionOrdering } from "@/data/crucible/collection-query"
import { projectSummaryQueryOptions } from "@/data/crucible/projects.queries"
import { personQueryOptions } from "@/data/crucible/people.queries"
import { resourceSummaryQueryOptions } from "@/data/crucible/resources.queries"
import type { WorkspaceSearchResult } from "@/data/crucible/workspace-source"
import {
  applyDataFilters,
  clearDataFilters,
  dataFacetContext,
  collectionQueryFilters,
  resolveDataFilters,
  resolveUsableDataFilters,
  setDataFilterProject,
} from "./data-filter-state"
import type {
  DataFilterError,
  DataFilterSearch,
  DataKindFilter,
  DataSearch,
  DataCollectionQueryFilters,
} from "./data-filter-state"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { searchDebounceMs } from "@/lib/search"
import type { FacetSelection } from "@/components/crucible/collection-facet-filter"
import type { FacetValueKey } from "@/data/crucible/filter-draft"
import {
  datasetsQueryOptions,
  samplesQueryOptions,
} from "@/data/crucible/data.queries"
import {
  DateRangeFilter,
  dateRangeLabel,
} from "@/components/crucible/date-range-filter"

const dataFilterRemoval: Readonly<
  Partial<Record<string, Partial<DataFilterSearch>>>
> = {
  affiliation: { affiliation: undefined },
  created: { createdFrom: undefined, createdTo: undefined },
  "data-format": {
    dataFormat: undefined,
    dataFormatIsNull: undefined,
    dataFormatSet: undefined,
  },
  instrument: {
    instrumentMfid: undefined,
    instrumentMfidIsNull: undefined,
  },
  measurement: {
    measurement: undefined,
    measurementIsNull: undefined,
    measurementSet: undefined,
  },
  owner: {
    ownerId: undefined,
    ownerIdIsNull: undefined,
    ownerIdSet: undefined,
  },
  project: { projectMfid: undefined, projectScope: undefined },
  "project-scope": { projectScope: undefined },
  "sample-type": {
    sampleType: undefined,
    sampleTypeIsNull: undefined,
    sampleTypeSet: undefined,
  },
  session: {
    sessionName: undefined,
    sessionNameIsNull: undefined,
    sessionNameSet: undefined,
  },
  visibility: { visibility: undefined },
}

const dataFormId = "data-filters"

/** Fields with a control on each tab; other invalid fields leave the draft. */
const dataControlFields: Record<"datasets" | "samples", readonly string[]> = {
  datasets: [
    "affiliation",
    "createdFrom",
    "createdTo",
    "dataFormat",
    "instrumentMfid",
    "measurement",
    "ownerId",
    "projectMfid",
    "projectScope",
    "publicData",
    "sessionName",
    "visibility",
  ],
  samples: [
    "affiliation",
    "createdFrom",
    "createdTo",
    "ownerId",
    "projectMfid",
    "projectScope",
    "publicData",
    "sampleType",
    "visibility",
  ],
}

export function DataFilters({
  defaultOrdering = defaultCollectionOrdering,
  errors,
  values,
}: {
  defaultOrdering?: CollectionOrdering
  errors: readonly DataFilterError[]
  values: DataSearch
}) {
  const navigate = useNavigate({ from: "/data" })
  const kind = dataKind(values.kind)
  const editableValues = withoutErrorFields(values, errors, kind)
  const [draft, setDraft] = useState<DataFilterSearch>(() =>
    filterDraft(editableValues)
  )
  const [draftErrors, setDraftErrors] =
    useState<readonly DataFilterError[]>(errors)
  const [filtersOpen, setFiltersOpen] = useState(errors.length > 0)
  const [projectName, setProjectName] = useState<string>()
  const scope = useWorkspaceScope()
  const includePublicByDefault = useIncludePublicByDefault()
  const elevated = privilegeModeFromScope(scope) === "elevated"
  const publicAccess = { elevated, includePublicByDefault }
  const applied = resolveUsableDataFilters(values, defaultOrdering).filters
  const draftResolution = resolveDataFilters(
    { ...editableValues, ...draft },
    defaultOrdering
  )
  const draftFilters = draftResolution.valid ? draftResolution.filters : applied
  const facetContext = dataFacetContext(draftFilters, publicAccess)
  const publicState = publicDataFilterState({
    elevated,
    includePublicByDefault,
    ownership: applied.affiliation,
    publicData: applied.publicData,
  })
  const draftPublicState = publicDataFilterState({
    elevated,
    includePublicByDefault,
    ownership: draft.affiliation === "owner" ? "owner" : undefined,
    publicData: draft.publicData,
  })
  const activeProjectMfid = applied.projectMfid
  const activeInstrumentMfid =
    applied.kind === "datasets" ? applied.instrumentMfid : undefined
  const activeOwnerId = applied.ownerId
  const projectResult = useQuery({
    ...projectSummaryQueryOptions(scope, activeProjectMfid ?? ""),
    enabled: Boolean(activeProjectMfid),
  })
  const instrumentResult = useQuery({
    ...resourceSummaryQueryOptions(scope, activeInstrumentMfid ?? ""),
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
  const valuesKey = JSON.stringify(filterDraft(editableValues))

  useEffect(() => {
    setDraft(JSON.parse(valuesKey) as DataFilterSearch)
    setDraftErrors(errorKey ? JSON.parse(errorKey) : [])
    setProjectName(undefined)
    if (hasErrors) setFiltersOpen(true)
  }, [errorKey, hasErrors, valuesKey])

  const countKey = useDebouncedValue(
    JSON.stringify(
      collectionQueryFilters(
        draftResolution.valid ? draftResolution.filters : applied,
        publicAccess
      )
    ),
    searchDebounceMs
  )
  const countFilters = JSON.parse(countKey) as DataCollectionQueryFilters
  const sampleCount = useQuery({
    ...samplesQueryOptions(scope, {
      ...countFilters,
      includeTotal: true,
      limit: 1,
    }),
    enabled: filtersOpen && kind === "samples" && draftResolution.valid,
  })
  const datasetCount = useQuery({
    ...datasetsQueryOptions(scope, {
      ...countFilters,
      includeTotal: true,
      limit: 1,
    }),
    enabled: filtersOpen && kind === "datasets" && draftResolution.valid,
  })
  const resultCount = draftResolution.valid
    ? ((kind === "samples" ? sampleCount.data : datasetCount.data)?.total ??
      undefined)
    : undefined

  const active = collectionActiveFilters(
    collectionActiveFilter(
      "public",
      publicState.included ? "Public" : undefined
    ),
    collectionActiveFilter(
      "affiliation",
      applied.affiliation ? "Ownership: Owned by me" : undefined
    ),
    collectionActiveFilter(
      "project",
      applied.projectMfid
        ? `Project: ${resolvedProjectName ?? applied.projectMfid}`
        : undefined
    ),
    collectionActiveFilter(
      "project-scope",
      applied.projectMfid && applied.projectScope !== "all"
        ? `Relationship: ${capitalize(applied.projectScope)}`
        : undefined
    ),
    collectionActiveFilter(
      "visibility",
      applied.visibility
        ? `Visibility: ${capitalize(applied.visibility)}`
        : undefined
    ),
    collectionActiveFilter(
      "owner",
      applied.ownerIdIsNull
        ? `Owner: ${facetNullLabel("owner")}`
        : activeOwnerId
          ? `Owner: ${resolvedOwnerName ?? activeOwnerId}`
          : undefined
    ),
    collectionActiveFilter(
      "sample-type",
      facetSummary("Sample type", applied.sampleType, applied.sampleTypeIsNull)
    ),
    collectionActiveFilter(
      "measurement",
      facetSummary(
        "Measurement",
        applied.measurement,
        applied.measurementIsNull
      )
    ),
    collectionActiveFilter(
      "session",
      facetSummary("Session", applied.sessionName, applied.sessionNameIsNull)
    ),
    collectionActiveFilter(
      "data-format",
      facetSummary("Data format", applied.dataFormat, applied.dataFormatIsNull)
    ),
    collectionActiveFilter(
      "created",
      dateRangeLabel("Created", {
        from: applied.createdFrom,
        to: applied.createdTo,
      })
    ),
    collectionActiveFilter(
      "instrument",
      applied.instrumentMfidIsNull
        ? `Instrument: ${facetNullLabel("instrument")}`
        : activeInstrumentMfid
          ? `Instrument: ${resolvedInstrumentName ?? activeInstrumentMfid}`
          : undefined
    )
  )
  const fieldError = (field: keyof DataFilterSearch) =>
    draftErrors.find((error) => error.field === field)?.message
  const otherErrors = draftErrors.filter(
    (error) => !dataControlFields[kind].includes(error.field)
  )
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
  const defaults = filterDraft({
    direction: values.direction,
    kind: values.kind,
    sort: values.sort,
  })

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = resolveDataFilters(
      { ...editableValues, ...draft },
      defaultOrdering
    )
    if (!next.valid) {
      setDraftErrors(next.errors)
      return
    }
    setDraftErrors([])
    setFiltersOpen(false)
    void navigate({
      search: (previous) =>
        applyDataFilters(previous, next.filters, defaultOrdering),
      state: {},
      to: "/data",
    })
  }

  function reset() {
    setDraft(defaults)
    setDraftErrors([])
    setProjectName(undefined)
  }

  function clear() {
    reset()
    void navigate({
      search: (previous) => clearDataFilters(previous),
      state: {},
      to: "/data",
    })
  }

  function changeOpen(nextOpen: boolean) {
    setFiltersOpen(nextOpen)
    if (nextOpen && !hasErrors) {
      setDraft(filterDraft(editableValues))
      setDraftErrors([])
      setProjectName(undefined)
    }
  }

  function removeFilter(id: string) {
    const changes =
      id === "public"
        ? { publicData: publicDataSearchValue(false, includePublicByDefault) }
        : dataFilterRemoval[id]
    if (!changes) return
    void navigate({
      search: (previous) => ({
        ...previous,
        ...changes,
        datasetCursor: undefined,
        preview: undefined,
        sampleCursor: undefined,
      }),
      state: {},
      to: "/data",
    })
  }

  function setFacet(
    value: FacetValueKey,
    set: `${FacetValueKey}Set`,
    isNull: `${FacetValueKey}IsNull`,
    selection: FacetSelection
  ) {
    setDraft((current) => setFacetDraft(current, value, set, isNull, selection))
  }

  const facetProps = {
    enabled: filtersOpen,
    filters: facetContext,
  }
  const ownerSelection = facetSelection(
    draft.ownerId,
    draft.ownerIdSet,
    draft.ownerIdIsNull
  )
  const ownerLabel =
    draft.ownerId === activeOwnerId ? resolvedOwnerName : undefined

  return (
    <CollectionFilterPanel
      activeFilters={active}
      formId={dataFormId}
      onClearFilters={clear}
      onOpenChange={changeOpen}
      onRemoveFilter={removeFilter}
      onReset={reset}
      open={filtersOpen}
      resetDisabled={JSON.stringify(draft) === JSON.stringify(defaults)}
      resultCount={resultCount}
      resultNoun={
        kind === "samples" ? ["sample", "samples"] : ["dataset", "datasets"]
      }
      title="Data filters"
    >
      <FilterForm id={dataFormId} onSubmit={apply}>
        {otherErrors.length ? <FieldError errors={[...otherErrors]} /> : null}
        <FilterSection title="Scope">
          {draftPublicState.available ? (
            <Field orientation="horizontal">
              <Checkbox
                checked={draftPublicState.included}
                disabled={!draftPublicState.enabled}
                id="data-public"
                onCheckedChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    publicData: publicDataSearchValue(
                      checked,
                      includePublicByDefault
                    ),
                  }))
                }
              />
              <FieldLabel htmlFor="data-public">Include public data</FieldLabel>
            </Field>
          ) : null}
          <FilterChoice
            error={fieldError("affiliation")}
            label="Ownership"
            onChange={(affiliation) =>
              setDraft((current) => ({
                ...current,
                affiliation: affiliation === "all" ? undefined : affiliation,
              }))
            }
            options={[
              { label: "All accessible", value: "all" },
              { label: "Owned by me", value: "owner" },
            ]}
            value={draft.affiliation === "owner" ? "owner" : "all"}
          />
          <FilterChoice
            error={fieldError("visibility")}
            label="Visibility"
            onChange={(visibility) =>
              setDraft((current) => ({ ...current, visibility }))
            }
            options={[
              { label: "All", value: "all" },
              { label: "Public", value: "public" },
              { label: "Private", value: "private" },
            ]}
            value={
              draft.visibility === "public" || draft.visibility === "private"
                ? draft.visibility
                : "all"
            }
          />
          <Field data-invalid={Boolean(fieldError("projectMfid"))}>
            <FieldLabel htmlFor="data-project-trigger">Project</FieldLabel>
            <ResourceChooser
              emptyLabel="Any project"
              invalid={Boolean(fieldError("projectMfid"))}
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
            <FieldError
              errors={
                fieldError("projectMfid")
                  ? [{ message: fieldError("projectMfid") }]
                  : []
              }
            />
          </Field>
          {draft.projectMfid ? (
            <FilterChoice
              error={fieldError("projectScope")}
              label="Relationship to this project"
              onChange={(projectScope) =>
                setDraft((current) => ({ ...current, projectScope }))
              }
              options={[
                { label: "All", value: "all" },
                { label: "Assigned", value: "assigned" },
                { label: "Shared", value: "shared" },
              ]}
              value={
                draft.projectScope === "assigned" ||
                draft.projectScope === "shared"
                  ? draft.projectScope
                  : "all"
              }
            />
          ) : null}
        </FilterSection>
        <FilterSection title="Details">
          {kind === "samples" ? (
            <>
              <SampleFacetFilter
                {...facetProps}
                field="owner"
                id="data-owner"
                label="Owner"
                onChange={(selection) =>
                  setFacet("ownerId", "ownerIdSet", "ownerIdIsNull", selection)
                }
                selectedLabel={ownerLabel}
                selection={ownerSelection}
              />
              <SampleFacetFilter
                {...facetProps}
                field="sample_type"
                id="data-sample-type"
                label="Sample type"
                onChange={(selection) =>
                  setFacet(
                    "sampleType",
                    "sampleTypeSet",
                    "sampleTypeIsNull",
                    selection
                  )
                }
                selection={facetSelection(
                  draft.sampleType,
                  draft.sampleTypeSet,
                  draft.sampleTypeIsNull
                )}
              />
            </>
          ) : (
            <>
              <DatasetFacetFilter
                {...facetProps}
                field="owner"
                id="data-owner"
                label="Owner"
                onChange={(selection) =>
                  setFacet("ownerId", "ownerIdSet", "ownerIdIsNull", selection)
                }
                selectedLabel={ownerLabel}
                selection={ownerSelection}
              />
              <DatasetFacetFilter
                {...facetProps}
                field="measurement"
                id="data-measurement"
                label="Measurement"
                onChange={(selection) =>
                  setFacet(
                    "measurement",
                    "measurementSet",
                    "measurementIsNull",
                    selection
                  )
                }
                selection={facetSelection(
                  draft.measurement,
                  draft.measurementSet,
                  draft.measurementIsNull
                )}
              />
              <DatasetFacetFilter
                {...facetProps}
                field="session"
                id="data-session"
                label="Session"
                onChange={(selection) =>
                  setFacet(
                    "sessionName",
                    "sessionNameSet",
                    "sessionNameIsNull",
                    selection
                  )
                }
                selection={facetSelection(
                  draft.sessionName,
                  draft.sessionNameSet,
                  draft.sessionNameIsNull
                )}
              />
              <DatasetFacetFilter
                {...facetProps}
                field="data_format"
                id="data-format"
                label="Data format"
                onChange={(selection) =>
                  setFacet(
                    "dataFormat",
                    "dataFormatSet",
                    "dataFormatIsNull",
                    selection
                  )
                }
                selection={facetSelection(
                  draft.dataFormat,
                  draft.dataFormatSet,
                  draft.dataFormatIsNull
                )}
              />
              <DatasetFacetFilter
                {...facetProps}
                field="instrument"
                id="data-instrument"
                label="Acquisition instrument"
                onChange={(selection) =>
                  setDraft((current) => ({
                    ...current,
                    instrumentMfid:
                      selection.kind === "value" ? selection.value : undefined,
                    instrumentMfidIsNull:
                      selection.kind === "null" || undefined,
                  }))
                }
                selectedLabel={
                  draft.instrumentMfid === activeInstrumentMfid
                    ? resolvedInstrumentName
                    : undefined
                }
                selection={
                  draft.instrumentMfidIsNull
                    ? { kind: "null" }
                    : draft.instrumentMfid
                      ? { kind: "value", value: draft.instrumentMfid }
                      : { kind: "all" }
                }
              />
            </>
          )}
        </FilterSection>
        <FilterSection title="Created">
          <DateRangeFilter
            errors={{
              from: fieldError("createdFrom"),
              to: fieldError("createdTo"),
            }}
            idPrefix="data-created"
            onChange={({ from, to }) =>
              setDraft((current) => ({
                ...current,
                createdFrom: from,
                createdTo: to,
              }))
            }
            value={{ from: draft.createdFrom, to: draft.createdTo }}
          />
        </FilterSection>
      </FilterForm>
    </CollectionFilterPanel>
  )
}

function withoutErrorFields(
  values: DataSearch,
  errors: readonly DataFilterError[],
  kind: "datasets" | "samples"
): DataSearch {
  const editable: DataSearch = { ...values }
  for (const error of errors) {
    if (!dataControlFields[kind].includes(error.field)) {
      editable[error.field] = undefined
    }
  }
  return editable
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
    publicData: values.publicData,
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
