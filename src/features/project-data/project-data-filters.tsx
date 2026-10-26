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

import {
  DatasetFacetFilter,
  facetNullLabel,
  SampleFacetFilter,
} from "@/components/crucible/collection-facet-filter"
import {
  collectionActiveFilter,
  collectionActiveFilters,
  CollectionFilterPanel,
  FilterChoice,
  FilterForm,
  FilterSection,
} from "@/components/crucible/collection-filter-panel"
import {
  capitalize,
  facetSelection,
  facetSummary,
  setFacetDraft,
} from "@/data/crucible/filter-draft"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import type { ProjectScope } from "@/data/crucible/data.queries"
import {
  collectionOrderingSearchState,
  defaultCollectionOrdering,
} from "@/data/crucible/collection-query"
import type { CollectionOrdering } from "@/data/crucible/collection-query"
import { personQueryOptions } from "@/data/crucible/people.queries"
import { resourceSummaryQueryOptions } from "@/data/crucible/resources.queries"

import type { ProjectDataKind } from "./project-data-collection"
import {
  resolveProjectDataFilters,
  resolveUsableProjectDataFilters,
} from "./project-data-filter-state"
import type {
  ProjectDataFilterError,
  ProjectDataFilterSearch,
  ProjectDataCollectionFilters,
} from "./project-data-filter-state"
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

type ProjectDataFilterDraft = ProjectDataFilterSearch & {
  projectScope: ProjectScope
}

type ProjectDataFilterRemoval = Partial<ProjectDataFilterSearch> & {
  scope?: undefined
}

const projectDataFilterRemoval: Readonly<
  Partial<Record<string, ProjectDataFilterRemoval>>
> = {
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
  "project-scope": { scope: undefined },
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

export function ProjectDataFilters({
  defaultOrdering = defaultCollectionOrdering,
  errors,
  kind,
  projectMfid,
  projectScope,
  values,
}: {
  defaultOrdering?: CollectionOrdering
  errors: readonly ProjectDataFilterError[]
  kind: ProjectDataKind
  projectMfid: string
  projectScope: ProjectScope
  values: ProjectDataFilterSearch
}) {
  const navigate = useNavigate({ from: "/projects/$projectMfid" })
  const controlFields: readonly string[] =
    kind === "samples"
      ? ["createdFrom", "createdTo", "ownerId", "sampleType", "visibility"]
      : [
          "createdFrom",
          "createdTo",
          "dataFormat",
          "instrumentMfid",
          "measurement",
          "ownerId",
          "sessionName",
          "visibility",
        ]
  const editableValues: ProjectDataFilterSearch = { ...values }
  for (const error of errors) {
    if (!controlFields.includes(error.field))
      editableValues[error.field] = undefined
  }
  const [draft, setDraft] = useState<ProjectDataFilterDraft>({
    ...editableValues,
    projectScope,
  })
  const [draftErrors, setDraftErrors] =
    useState<readonly ProjectDataFilterError[]>(errors)
  const [filtersOpen, setFiltersOpen] = useState(errors.length > 0)
  const scope = useWorkspaceScope()
  const includePublicByDefault = useIncludePublicByDefault()
  const elevated = privilegeModeFromScope(scope) === "elevated"
  const access = { elevated, includePublicByDefault }
  const applied = resolveUsableProjectDataFilters(
    values,
    kind,
    defaultOrdering,
    access
  )
  const draftResolution = resolveProjectDataFilters(
    draft,
    kind,
    defaultOrdering,
    access
  )
  const facetContext = {
    ...(draftResolution.valid ? draftResolution.filters : applied),
    projectMfid,
    projectScope: draft.projectScope,
  }
  const activeInstrumentMfid =
    kind === "datasets" ? applied.instrumentMfid : undefined
  const activeOwnerId = applied.ownerId
  const publicState = publicDataFilterState({
    elevated,
    includePublicByDefault,
    publicData: values.publicData,
  })
  const draftPublicState = publicDataFilterState({
    elevated,
    includePublicByDefault,
    publicData: draft.publicData,
  })
  const instrumentResult = useQuery({
    ...resourceSummaryQueryOptions(scope, activeInstrumentMfid ?? ""),
    enabled: Boolean(activeInstrumentMfid),
  })
  const ownerResult = useQuery({
    ...personQueryOptions(scope, activeOwnerId ?? ""),
    enabled: Boolean(activeOwnerId),
  })
  const resolvedInstrument =
    instrumentResult.data?.kind === "instrument"
      ? instrumentResult.data.name
      : undefined
  const resolvedOwner = ownerResult.data
    ? `${ownerResult.data.first_name} ${ownerResult.data.last_name}`.trim()
    : undefined
  const errorKey = JSON.stringify(errors)
  const hasErrors = errors.length > 0
  const valuesKey = JSON.stringify(editableValues)

  useEffect(() => {
    setDraft({
      ...(JSON.parse(valuesKey) as ProjectDataFilterSearch),
      projectScope,
    })
    setDraftErrors(errorKey ? JSON.parse(errorKey) : [])
    if (hasErrors) setFiltersOpen(true)
  }, [errorKey, hasErrors, projectScope, valuesKey])

  const countKey = useDebouncedValue(
    JSON.stringify({
      ...(draftResolution.valid ? draftResolution.filters : applied),
      includeTotal: true,
      limit: 1,
      projectMfid,
      projectScope: draft.projectScope,
    }),
    searchDebounceMs
  )
  const countFilters = JSON.parse(countKey) as ProjectDataCollectionFilters & {
    includeTotal: true
    limit: number
    projectMfid: string
    projectScope: ProjectScope
  }
  const sampleCount = useQuery({
    ...samplesQueryOptions(scope, countFilters),
    enabled: filtersOpen && kind === "samples" && draftResolution.valid,
  })
  const datasetCount = useQuery({
    ...datasetsQueryOptions(scope, countFilters),
    enabled: filtersOpen && kind === "datasets" && draftResolution.valid,
  })
  const boundsFilters = {
    ...countFilters,
    createdFrom: undefined,
    createdTo: undefined,
    includeTotal: false,
    limit: 1,
  }
  const firstSample = useQuery({
    ...samplesQueryOptions(scope, {
      ...boundsFilters,
      direction: "asc",
      sort: "created",
    }),
    enabled: filtersOpen && kind === "samples",
  })
  const lastSample = useQuery({
    ...samplesQueryOptions(scope, {
      ...boundsFilters,
      direction: "desc",
      sort: "created",
    }),
    enabled: filtersOpen && kind === "samples",
  })
  const firstDataset = useQuery({
    ...datasetsQueryOptions(scope, {
      ...boundsFilters,
      direction: "asc",
      sort: "created",
    }),
    enabled: filtersOpen && kind === "datasets",
  })
  const lastDataset = useQuery({
    ...datasetsQueryOptions(scope, {
      ...boundsFilters,
      direction: "desc",
      sort: "created",
    }),
    enabled: filtersOpen && kind === "datasets",
  })
  const createdBounds =
    kind === "samples"
      ? {
          earliest: firstSample.data?.items[0]?.creation_time,
          latest: lastSample.data?.items[0]?.creation_time,
        }
      : {
          earliest: firstDataset.data?.items[0]?.creation_time,
          latest: lastDataset.data?.items[0]?.creation_time,
        }
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
      "project-scope",
      projectScope !== "all"
        ? `Relationship to this project: ${capitalize(projectScope)}`
        : undefined
    ),
    collectionActiveFilter(
      "visibility",
      applied.visibility
        ? `Visibility: ${capitalize(applied.visibility)}`
        : undefined
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
          ? `Instrument: ${resolvedInstrument ?? activeInstrumentMfid}`
          : undefined
    ),
    collectionActiveFilter(
      "owner",
      applied.ownerIdIsNull
        ? `Owner: ${facetNullLabel("owner")}`
        : activeOwnerId
          ? `Owner: ${resolvedOwner ?? activeOwnerId}`
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
    )
  )
  const fieldError = (field: keyof ProjectDataFilterSearch) =>
    draftErrors.find((error) => error.field === field)?.message
  const otherErrors = draftErrors.filter(
    (error) => !controlFields.includes(error.field)
  )
  const defaults: ProjectDataFilterDraft = {
    direction: values.direction,
    projectScope: "all",
    sort: values.sort,
  }

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = resolveProjectDataFilters(draft, kind, defaultOrdering)
    if (!next.valid) {
      setDraftErrors(next.errors)
      return
    }
    setDraftErrors([])
    setFiltersOpen(false)
    const ordering = collectionOrderingSearchState(
      next.filters.sort,
      next.filters.direction,
      defaultOrdering
    )
    void navigate({
      params: { projectMfid },
      search: (previous) => ({
        ...previous,
        groupValue: undefined,
        groupValueIsNull: undefined,
        groupValueSet: undefined,
        createdFrom: next.filters.createdFrom,
        createdTo: next.filters.createdTo,
        dataFormat: next.filters.dataFormat,
        dataFormatIsNull: next.filters.dataFormatIsNull,
        dataFormatSet: next.filters.dataFormat !== undefined || undefined,
        datasetCursor: undefined,
        direction: ordering.direction,
        instrumentMfid:
          kind === "datasets" ? next.filters.instrumentMfid : undefined,
        instrumentMfidIsNull:
          kind === "datasets" ? next.filters.instrumentMfidIsNull : undefined,
        measurement: next.filters.measurement,
        measurementIsNull: next.filters.measurementIsNull,
        measurementSet: next.filters.measurement !== undefined || undefined,
        ownerId: next.filters.ownerId,
        ownerIdIsNull: next.filters.ownerIdIsNull,
        ownerIdSet: next.filters.ownerId !== undefined || undefined,
        preview: undefined,
        publicData: draft.publicData,
        sampleCursor: undefined,
        sampleType: next.filters.sampleType,
        sampleTypeIsNull: next.filters.sampleTypeIsNull,
        sampleTypeSet: next.filters.sampleType !== undefined || undefined,
        scope: draft.projectScope === "all" ? undefined : draft.projectScope,
        sessionName: next.filters.sessionName,
        sessionNameIsNull: next.filters.sessionNameIsNull,
        sessionNameSet: next.filters.sessionName !== undefined || undefined,
        sort: ordering.sort,
        visibility: next.filters.visibility,
      }),
      state: {},
      to: "/projects/$projectMfid",
    })
  }

  function reset() {
    setDraft(defaults)
    setDraftErrors([])
  }

  function clear() {
    reset()
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
        instrumentMfid: undefined,
        instrumentMfidIsNull: undefined,
        measurement: undefined,
        measurementIsNull: undefined,
        measurementSet: undefined,
        ownerId: undefined,
        ownerIdIsNull: undefined,
        ownerIdSet: undefined,
        preview: undefined,
        publicData: undefined,
        sampleCursor: undefined,
        sampleType: undefined,
        sampleTypeIsNull: undefined,
        sampleTypeSet: undefined,
        scope: undefined,
        sessionName: undefined,
        sessionNameIsNull: undefined,
        sessionNameSet: undefined,
        visibility: undefined,
      }),
      state: {},
      to: "/projects/$projectMfid",
    })
  }

  function changeOpen(nextOpen: boolean) {
    setFiltersOpen(nextOpen)
    if (nextOpen && !hasErrors) {
      setDraft({ ...editableValues, projectScope })
      setDraftErrors([])
    }
  }

  function removeFilter(id: string) {
    const changes =
      id === "public"
        ? { publicData: publicDataSearchValue(false, includePublicByDefault) }
        : projectDataFilterRemoval[id]
    if (!changes) return
    void navigate({
      params: { projectMfid },
      search: (previous) => ({
        ...previous,
        ...changes,
        datasetCursor: undefined,
        preview: undefined,
        sampleCursor: undefined,
      }),
      state: {},
      to: "/projects/$projectMfid",
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

  const facetProps = { enabled: filtersOpen, filters: facetContext }
  const ownerSelection = facetSelection(
    draft.ownerId,
    draft.ownerIdSet,
    draft.ownerIdIsNull
  )
  const ownerLabel = draft.ownerId === activeOwnerId ? resolvedOwner : undefined
  const formId = "project-data-filters"

  return (
    <CollectionFilterPanel
      activeFilters={active}
      formId={formId}
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
      title="Project data filters"
    >
      <FilterForm id={formId} onSubmit={apply}>
        {otherErrors.length ? <FieldError errors={[...otherErrors]} /> : null}
        <FilterSection title="Scope">
          {draftPublicState.available ? (
            <Field orientation="horizontal">
              <Checkbox
                checked={draftPublicState.included}
                id="project-data-public"
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
              <FieldLabel htmlFor="project-data-public">
                Include public data
              </FieldLabel>
            </Field>
          ) : null}
          <FilterChoice
            label="Relationship to this project"
            onChange={(next) =>
              setDraft((current) => ({ ...current, projectScope: next }))
            }
            options={[
              { label: "All", value: "all" },
              { label: "Assigned", value: "assigned" },
              { label: "Shared", value: "shared" },
            ]}
            value={draft.projectScope}
          />
          <FilterChoice
            error={fieldError("visibility")}
            label="Visibility"
            onChange={(visibility) =>
              setDraft((current) => ({
                ...current,
                visibility: visibility === "all" ? undefined : visibility,
              }))
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
        </FilterSection>
        <FilterSection title="Details">
          {kind === "samples" ? (
            <>
              <SampleFacetFilter
                {...facetProps}
                field="owner"
                id="project-data-owner"
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
                id="project-data-sample-type"
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
                id="project-data-owner"
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
                id="project-data-measurement"
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
                id="project-data-session"
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
                id="project-data-format"
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
                id="project-data-instrument"
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
                    ? resolvedInstrument
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
            bounds={createdBounds}
            errors={{
              from: fieldError("createdFrom"),
              to: fieldError("createdTo"),
            }}
            idPrefix="project-data-created"
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
