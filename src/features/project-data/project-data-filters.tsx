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
  SampleFacetFilter,
} from "@/components/crucible/collection-facet-filter"
import {
  CollectionFilterPanel,
  collectionActiveFilter,
  collectionActiveFilters,
} from "@/components/crucible/collection-filter-panel"
import {
  CollectionCreatedRangeFields,
  CollectionOrderFields,
} from "@/components/crucible/collection-query-fields"
import {
  capitalize,
  facetSelection,
  facetSummary,
  setFacetDraft,
  sortLabel,
} from "@/data/crucible/filter-draft"
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
import type { ProjectScope } from "@/data/crucible/data.queries"
import {
  collectionOrderingSearchState,
  defaultCollectionOrdering,
} from "@/data/crucible/collection-query"
import type { CollectionOrdering } from "@/data/crucible/collection-query"
import { personQueryOptions } from "@/data/crucible/people.queries"
import { resourceSummaryQueryOptions } from "@/data/crucible/resources.queries"

import type { ProjectDataKind } from "./project-data-collection"
import { resolveProjectDataFilters } from "./project-data-filter-state"
import type {
  ProjectDataFilterError,
  ProjectDataFilterSearch,
} from "./project-data-filter-state"

type ProjectDataFilterDraft = ProjectDataFilterSearch & {
  projectScope: ProjectScope
}

type ProjectDataFilterRemoval = Partial<ProjectDataFilterSearch> & {
  scope?: undefined
}

const projectDataFilterRemoval: Readonly<
  Partial<Record<string, ProjectDataFilterRemoval>>
> = {
  "created-from": { createdFrom: undefined },
  "created-to": { createdTo: undefined },
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
  order: { direction: undefined, sort: undefined },
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
  const [draft, setDraft] = useState<ProjectDataFilterDraft>({
    ...values,
    projectScope,
  })
  const [draftErrors, setDraftErrors] =
    useState<readonly ProjectDataFilterError[]>(errors)
  const [filtersOpen, setFiltersOpen] = useState(errors.length > 0)
  const scope = useWorkspaceScope()
  const includePublicByDefault = useIncludePublicByDefault()
  const elevated = privilegeModeFromScope(scope) === "elevated"
  const resolution = resolveProjectDataFilters(values, kind, defaultOrdering, {
    elevated,
    includePublicByDefault,
  })
  const activeInstrumentMfid =
    resolution.valid && kind === "datasets"
      ? resolution.filters.instrumentMfid
      : undefined
  const activeOwnerId = resolution.valid
    ? resolution.filters.ownerId
    : undefined
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
  const valuesKey = JSON.stringify(values)

  useEffect(() => {
    setDraft({
      ...(JSON.parse(valuesKey) as ProjectDataFilterSearch),
      projectScope,
    })
    setDraftErrors(errorKey ? JSON.parse(errorKey) : [])
    if (hasErrors) setFiltersOpen(true)
  }, [errorKey, hasErrors, projectScope, valuesKey])

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
      values.visibility && values.visibility !== "all"
        ? `Visibility: ${capitalize(values.visibility)}`
        : undefined
    ),
    collectionActiveFilter(
      "created-from",
      values.createdFrom ? `Created from: ${values.createdFrom}` : undefined
    ),
    collectionActiveFilter(
      "created-to",
      values.createdTo ? `Created to: ${values.createdTo}` : undefined
    ),
    collectionActiveFilter(
      "instrument",
      resolution.valid && resolution.filters.instrumentMfidIsNull
        ? "Instrument: Unspecified"
        : activeInstrumentMfid
          ? `Instrument: ${resolvedInstrument ?? activeInstrumentMfid}`
          : undefined
    ),
    collectionActiveFilter(
      "owner",
      resolution.valid && resolution.filters.ownerIdIsNull
        ? "Owner: Unspecified"
        : activeOwnerId
          ? `Owner: ${resolvedOwner ?? activeOwnerId}`
          : undefined
    ),
    collectionActiveFilter(
      "sample-type",
      resolution.valid
        ? facetSummary(
            "Sample type",
            resolution.filters.sampleType,
            resolution.filters.sampleTypeIsNull
          )
        : undefined
    ),
    collectionActiveFilter(
      "measurement",
      resolution.valid
        ? facetSummary(
            "Measurement",
            resolution.filters.measurement,
            resolution.filters.measurementIsNull
          )
        : undefined
    ),
    collectionActiveFilter(
      "session",
      resolution.valid
        ? facetSummary(
            "Session",
            resolution.filters.sessionName,
            resolution.filters.sessionNameIsNull
          )
        : undefined
    ),
    collectionActiveFilter(
      "data-format",
      resolution.valid
        ? facetSummary(
            "Data format",
            resolution.filters.dataFormat,
            resolution.filters.dataFormatIsNull
          )
        : undefined
    ),
    collectionActiveFilter(
      "order",
      resolution.valid && values.sort
        ? `Order: ${sortLabel(resolution.filters.sort)} (${resolution.filters.direction === "asc" ? "ascending" : "descending"})`
        : undefined
    )
  )
  const invalid = (field: keyof ProjectDataFilterSearch) =>
    draftErrors.some((error) => error.field === field)
  const errorDescription = draftErrors.length
    ? "project-data-filter-errors"
    : undefined

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

  function clear() {
    setDraft({ projectScope: "all" })
    setDraftErrors([])
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
        sort: undefined,
        visibility: undefined,
      }),
      state: {},
      to: "/projects/$projectMfid",
    })
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

  return (
    <CollectionFilterPanel
      activeFilters={active}
      footer={
        <>
          <Button onClick={clear} type="button" variant="outline">
            Clear filters
          </Button>
          <Button form="project-data-filters" type="submit">
            Apply filters
          </Button>
        </>
      }
      onClearFilters={clear}
      onOpenChange={setFiltersOpen}
      onRemoveFilter={removeFilter}
      open={filtersOpen}
      title="Project data filters"
    >
      <form
        className="flex flex-col gap-4"
        id="project-data-filters"
        onSubmit={apply}
      >
        <FieldSet>
          <FieldLegend className="sr-only">Project data filters</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            {draftPublicState.available ? (
              <Field className="sm:col-span-2" orientation="horizontal">
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
                field="owner"
                filters={{
                  ...resolution.filters,
                  projectMfid,
                  projectScope,
                }}
                id="project-data-owner"
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
                filters={{
                  ...resolution.filters,
                  projectMfid,
                  projectScope,
                }}
                id="project-data-owner"
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
            <CollectionCreatedRangeFields
              describedBy={errorDescription}
              idPrefix="project-data"
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
                filters={{
                  ...resolution.filters,
                  projectMfid,
                  projectScope,
                }}
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
              defaultOrdering={defaultOrdering}
              describedBy={errorDescription}
              idPrefix="project-data"
              invalid={invalid}
              onChange={(value) =>
                setDraft((current) => ({ ...current, ...value }))
              }
              value={draft}
            />
          </FieldGroup>
        </FieldSet>
        {draftErrors.length ? (
          <FieldError
            id="project-data-filter-errors"
            errors={[...draftErrors]}
          />
        ) : null}
      </form>
    </CollectionFilterPanel>
  )
}
