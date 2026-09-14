import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"

import {
  CollectionGroupControl,
  CollectionToolbar,
  DatasetCollectionBrowser,
  SampleCollectionBrowser,
} from "@/components/crucible/collection-browser"
import {
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import {
  collectionBrowseSearchState,
  clearCollectionGroupFilterSearch,
  datasetFiltersForGroup,
  projectDatasetBrowseOptions,
  projectSampleBrowseOptions,
  resolveCollectionBrowse,
  sampleFiltersForGroup,
} from "@/data/crucible/collection-browse"
import type { CollectionBrowseSearch } from "@/data/crucible/collection-browse"
import {
  ResourceOpenCell,
  ResourceOwnerCell,
  ResourceProjectCell,
  ResourceUpdatedCell,
} from "@/components/crucible/resource-collection-cells"
import { ResourceCollectionNameCell } from "@/components/crucible/resource-collection-name-cell"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  dataPageLimit,
  datasetsQueryOptions,
  samplesQueryOptions,
} from "@/data/crucible/data.queries"
import type { ProjectScope } from "@/data/crucible/data.queries"
import type {
  DatasetFacetField,
  FacetSelection,
  SampleFacetField,
} from "@/data/crucible/facets"
import type {
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"
import { HubApiClientError } from "@/data/crucible/result"
import type {
  WorkspaceDataset,
  WorkspaceSample,
} from "@/data/crucible/workspace-source"

import { ProjectDataFilters } from "./project-data-filters"
import type {
  ProjectDataFilterResolution,
  ProjectDataFilterSearch,
  ProjectDataCollectionFilters,
} from "./project-data-filter-state"

export type ProjectDataKind = "datasets" | "samples"

export function ProjectDataCollection({
  browseSearch,
  cursor,
  filterResolution,
  filterValues,
  kind,
  projectMfid,
  projectScope,
}: {
  browseSearch: CollectionBrowseSearch
  cursor: string | undefined
  filterResolution: ProjectDataFilterResolution
  filterValues: ProjectDataFilterSearch
  kind: ProjectDataKind
  projectMfid: string
  projectScope: ProjectScope
}) {
  const navigate = useNavigate({ from: "/projects/$projectMfid" })
  const sampleBrowse =
    kind === "samples"
      ? resolveCollectionBrowse(browseSearch, projectSampleBrowseOptions)
      : undefined
  const datasetBrowse =
    kind === "datasets"
      ? resolveCollectionBrowse(browseSearch, projectDatasetBrowseOptions)
      : undefined
  const onSort = (sort: ResourceSort, direction: SortDirection) =>
    void navigate({
      params: { projectMfid },
      search: (previous) => ({
        ...previous,
        datasetCursor: undefined,
        direction,
        preview: undefined,
        sampleCursor: undefined,
        sort,
      }),
      state: {},
      to: "/projects/$projectMfid",
    })
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ProjectBrowseFrame
        datasetBrowse={datasetBrowse}
        filters={filterResolution.valid ? filterResolution.filters : undefined}
        projectMfid={projectMfid}
        projectScope={projectScope}
        sampleBrowse={sampleBrowse}
        toolbarActions={
          <ProjectDataFilters
            errors={filterResolution.valid ? [] : filterResolution.errors}
            kind={kind}
            projectMfid={projectMfid}
            projectScope={projectScope}
            values={filterValues}
          />
        }
        toolbarPrimary={
          <ProjectDataTypeFilters
            kind={kind}
            projectMfid={projectMfid}
            projectScope={projectScope}
          />
        }
      >
        {!filterResolution.valid ? (
          <Empty className="min-h-state border" role="alert">
            <EmptyHeader>
              <EmptyTitle>Project data filters are not valid</EmptyTitle>
              <EmptyDescription>
                Correct or clear the filters before loading project data.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : kind === "samples" ? (
          <ProjectSamples
            cursor={cursor}
            filters={
              sampleBrowse?.view === "grouped"
                ? sampleFiltersForGroup(
                    filterResolution.filters,
                    sampleBrowse.field,
                    sampleBrowse.selection
                  )
                : filterResolution.filters
            }
            onSort={onSort}
            projectMfid={projectMfid}
            projectScope={projectScope}
          />
        ) : (
          <ProjectDatasets
            cursor={cursor}
            filters={
              datasetBrowse?.view === "grouped"
                ? datasetFiltersForGroup(
                    filterResolution.filters,
                    datasetBrowse.field,
                    datasetBrowse.selection
                  )
                : filterResolution.filters
            }
            onSort={onSort}
            projectMfid={projectMfid}
            projectScope={projectScope}
          />
        )}
      </ProjectBrowseFrame>
    </div>
  )
}

type ProjectBrowseState<TField extends string> = {
  field: TField
  selection: FacetSelection
  view: "grouped" | "list"
}

function ProjectBrowseFrame({
  children,
  datasetBrowse,
  filters,
  projectMfid,
  projectScope,
  sampleBrowse,
  toolbarActions,
  toolbarPrimary,
}: {
  children: React.ReactNode
  datasetBrowse?: ProjectBrowseState<DatasetFacetField>
  filters: ProjectDataCollectionFilters | undefined
  projectMfid: string
  projectScope: ProjectScope
  sampleBrowse?: ProjectBrowseState<SampleFacetField>
  toolbarActions: React.ReactNode
  toolbarPrimary: React.ReactNode
}) {
  const navigate = useNavigate({ from: "/projects/$projectMfid" })
  const browse = sampleBrowse ?? datasetBrowse
  if (!browse) return children
  const browseField = browse.field

  function updateSearch(values: Record<string, unknown>) {
    void navigate({
      params: { projectMfid },
      search: (previous) => ({
        ...previous,
        datasetCursor: undefined,
        preview: undefined,
        sampleCursor: undefined,
        ...values,
      }),
      state: {},
      to: "/projects/$projectMfid",
    })
  }

  function changeGroup(
    field: DatasetFacetField | SampleFacetField | undefined
  ) {
    updateSearch({
      ...collectionBrowseSearchState({ kind: "all" }),
      ...clearCollectionGroupFilterSearch(field ?? browseField),
      groupBy: field,
      view: field ? "grouped" : undefined,
    })
  }

  function selectGroup(selection: FacetSelection) {
    updateSearch({
      ...collectionBrowseSearchState(selection),
      ...clearCollectionGroupFilterSearch(browseField),
    })
  }

  const toolbar = (
    <CollectionToolbar
      actions={
        <>
          {toolbarActions}
          <CollectionGroupControl
            disabled={!filters}
            field={browse.field}
            id={
              sampleBrowse
                ? "project-sample-group-field"
                : "project-dataset-group-field"
            }
            onChange={changeGroup}
            options={
              sampleBrowse
                ? projectSampleBrowseOptions
                : projectDatasetBrowseOptions
            }
            view={browse.view}
          />
        </>
      }
      primary={toolbarPrimary}
    />
  )

  if (!filters) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        {children}
      </div>
    )
  }

  const facetFilters = { ...filters, projectMfid, projectScope }
  if (sampleBrowse) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        {sampleBrowse.view === "grouped" ? (
          <SampleCollectionBrowser
            field={sampleBrowse.field}
            filters={facetFilters}
            onSelect={selectGroup}
            selection={sampleBrowse.selection}
          >
            {children}
          </SampleCollectionBrowser>
        ) : (
          children
        )}
      </div>
    )
  }

  if (!datasetBrowse) return children
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {toolbar}
      {datasetBrowse.view === "grouped" ? (
        <DatasetCollectionBrowser
          field={datasetBrowse.field}
          filters={facetFilters}
          onSelect={selectGroup}
          selection={datasetBrowse.selection}
        >
          {children}
        </DatasetCollectionBrowser>
      ) : (
        children
      )}
    </div>
  )
}

function ProjectSamples({
  cursor,
  filters,
  onSort,
  projectMfid,
  projectScope,
}: {
  cursor: string | undefined
  filters: ProjectDataCollectionFilters
  onSort: (sort: ResourceSort, direction: SortDirection) => void
  projectMfid: string
  projectScope: ProjectScope
}) {
  const scope = useWorkspaceScope()
  const result = useQuery(
    samplesQueryOptions(scope, {
      cursor,
      ...filters,
      limit: dataPageLimit,
      projectMfid,
      projectScope,
    })
  )

  if (result.isPending) return <CollectionTablePending label="samples" />
  if (result.isError && !result.data) {
    return (
      <ProjectDataLoadError
        cursor={cursor}
        error={result.error}
        kind="samples"
        projectMfid={projectMfid}
        retry={() => void result.refetch()}
      />
    )
  }

  return (
    <ProjectDataResult
      cursor={cursor}
      direction={filters.direction ?? "desc"}
      error={result.isError}
      items={result.data.items}
      kind="samples"
      nextCursor={result.data.nextCursor}
      onSort={onSort}
      projectMfid={projectMfid}
      retry={() => void result.refetch()}
      sort={filters.sort}
      updating={result.isFetching}
    />
  )
}

function ProjectDatasets({
  cursor,
  filters,
  onSort,
  projectMfid,
  projectScope,
}: {
  cursor: string | undefined
  filters: ProjectDataCollectionFilters
  onSort: (sort: ResourceSort, direction: SortDirection) => void
  projectMfid: string
  projectScope: ProjectScope
}) {
  const scope = useWorkspaceScope()
  const result = useQuery(
    datasetsQueryOptions(scope, {
      cursor,
      ...filters,
      limit: dataPageLimit,
      projectMfid,
      projectScope,
    })
  )

  if (result.isPending) return <CollectionTablePending label="datasets" />
  if (result.isError && !result.data) {
    return (
      <ProjectDataLoadError
        cursor={cursor}
        error={result.error}
        kind="datasets"
        projectMfid={projectMfid}
        retry={() => void result.refetch()}
      />
    )
  }

  return (
    <ProjectDataResult
      cursor={cursor}
      direction={filters.direction ?? "desc"}
      error={result.isError}
      items={result.data.items}
      kind="datasets"
      nextCursor={result.data.nextCursor}
      onSort={onSort}
      projectMfid={projectMfid}
      retry={() => void result.refetch()}
      sort={filters.sort}
      updating={result.isFetching}
    />
  )
}

function ProjectDataResult({
  cursor,
  direction,
  error,
  items,
  kind,
  nextCursor,
  onSort,
  projectMfid,
  retry,
  sort,
  updating,
}:
  | {
      cursor: string | undefined
      direction: SortDirection
      error: boolean
      items: readonly WorkspaceSample[]
      kind: "samples"
      nextCursor: string | null
      onSort: (sort: ResourceSort, direction: SortDirection) => void
      projectMfid: string
      retry: () => void
      sort: ResourceSort | undefined
      updating: boolean
    }
  | {
      cursor: string | undefined
      direction: SortDirection
      error: boolean
      items: readonly WorkspaceDataset[]
      kind: "datasets"
      nextCursor: string | null
      onSort: (sort: ResourceSort, direction: SortDirection) => void
      projectMfid: string
      retry: () => void
      sort: ResourceSort | undefined
      updating: boolean
    }) {
  const label = kind === "samples" ? "Samples" : "Datasets"
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CollectionUpdateStatus label={label.toLowerCase()} updating={updating} />
      {error ? (
        <CollectionUpdateError label={label} preserved retry={retry} />
      ) : null}
      {items.length ? (
        <Card aria-busy={updating}>
          <CardContent className="px-0">
            {kind === "samples" ? (
              <ProjectSampleTable
                direction={direction}
                items={items}
                onSort={onSort}
                projectMfid={projectMfid}
                sort={sort}
              />
            ) : (
              <ProjectDatasetTable
                direction={direction}
                items={items}
                onSort={onSort}
                projectMfid={projectMfid}
                sort={sort}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Empty className="min-h-state border">
          <EmptyHeader>
            <EmptyTitle>
              No {label.toLowerCase()} match these filters
            </EmptyTitle>
            <EmptyDescription>
              Try changing the filters or data type.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {!updating && nextCursor ? (
        <nav className="flex justify-end" aria-label={`Project ${kind} pages`}>
          <Link
            className={buttonVariants({ variant: "outline" })}
            from="/projects/$projectMfid"
            params={{ projectMfid }}
            search={(previous) => ({
              ...previous,
              [kind === "samples" ? "sampleCursor" : "datasetCursor"]:
                nextCursor,
              preview: undefined,
            })}
            state={{}}
            to="/projects/$projectMfid"
          >
            Next {kind}
          </Link>
        </nav>
      ) : null}
      {cursor && !nextCursor && !items.length ? (
        <FirstPageLink kind={kind} projectMfid={projectMfid} />
      ) : null}
    </div>
  )
}

function ProjectSampleTable({
  direction,
  items,
  onSort,
  projectMfid,
  sort,
}: {
  direction: SortDirection
  items: readonly WorkspaceSample[]
  onSort: (sort: ResourceSort, direction: SortDirection) => void
  projectMfid: string
  sort: ResourceSort | undefined
}) {
  return (
    <ProjectTable direction={direction} onSort={onSort} sort={sort}>
      {items.map((sample) => (
        <TableRow key={sample.unique_id}>
          <ResourceCollectionNameCell
            className="resource-collection-name"
            kind="sample"
            mfid={sample.unique_id}
            name={sample.sample_name}
            subtype={sample.sample_type ?? "Unspecified sample type"}
            subtypeVisibility="always"
          />
          <ResourceProjectCell
            project={sample.project}
            projectId={sample.project_id}
            relation={sample.project_relation}
          />
          <ResourceOwnerCell owner={sample.owner} />
          <ResourceUpdatedCell
            value={sample.modification_time ?? sample.creation_time}
          />
          <ResourceOpenCell
            fromProject={projectMfid}
            kind="sample"
            mfid={sample.unique_id}
            name={sample.sample_name}
          />
        </TableRow>
      ))}
    </ProjectTable>
  )
}

function ProjectDatasetTable({
  direction,
  items,
  onSort,
  projectMfid,
  sort,
}: {
  direction: SortDirection
  items: readonly WorkspaceDataset[]
  onSort: (sort: ResourceSort, direction: SortDirection) => void
  projectMfid: string
  sort: ResourceSort | undefined
}) {
  return (
    <ProjectTable direction={direction} onSort={onSort} sort={sort}>
      {items.map((dataset) => (
        <TableRow key={dataset.unique_id}>
          <ResourceCollectionNameCell
            className="resource-collection-name"
            kind="dataset"
            mfid={dataset.unique_id}
            name={dataset.dataset_name ?? "Untitled dataset"}
            subtype={dataset.measurement ?? "Unspecified measurement"}
            subtypeVisibility="always"
          />
          <ResourceProjectCell
            project={dataset.project}
            projectId={dataset.project_id}
            relation={dataset.project_relation}
          />
          <ResourceOwnerCell owner={dataset.owner} />
          <ResourceUpdatedCell
            value={dataset.modification_time ?? dataset.creation_time}
          />
          <ResourceOpenCell
            fromProject={projectMfid}
            kind="dataset"
            mfid={dataset.unique_id}
            name={dataset.dataset_name ?? "Untitled dataset"}
          />
        </TableRow>
      ))}
    </ProjectTable>
  )
}

function ProjectTable({
  children,
  direction,
  onSort,
  sort,
}: {
  children: React.ReactNode
  direction: SortDirection
  onSort: (sort: ResourceSort, direction: SortDirection) => void
  sort: ResourceSort | undefined
}) {
  return (
    <Table className="resource-collection-table table-fixed">
      <colgroup>
        <col className="w-data-name-column-with-action xl:w-data-name-column-wide-with-action" />
        <col className="w-data-project-column-with-action xl:w-data-project-column-wide-with-action" />
        <col className="w-data-owner-column-with-action xl:w-data-owner-column-wide-with-action" />
        <col className="w-data-date-column-with-action xl:w-data-date-column-wide-with-action" />
        <col className="w-data-action-column" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            active={sort === "name"}
            direction={direction}
            field="name"
            label="Name"
            onChange={onSort}
          />
          <TableHead>Project</TableHead>
          <TableHead>Owner</TableHead>
          <SortableTableHead
            active={sort === "updated"}
            direction={direction}
            field="updated"
            label="Updated"
            onChange={onSort}
          />
          <TableHead className="text-center">
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  )
}

function ProjectDataTypeFilters({
  kind,
  projectMfid,
  projectScope,
}: {
  kind: ProjectDataKind
  projectMfid: string
  projectScope: ProjectScope
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Project data type">
      <ProjectDataFilterLink
        active={kind === "samples"}
        kind="samples"
        label="Samples"
        projectMfid={projectMfid}
        projectScope={projectScope}
      />
      <ProjectDataFilterLink
        active={kind === "datasets"}
        kind="datasets"
        label="Datasets"
        projectMfid={projectMfid}
        projectScope={projectScope}
      />
    </div>
  )
}

function ProjectDataFilterLink({
  active,
  kind,
  label,
  projectMfid,
  projectScope,
}: {
  active: boolean
  kind: ProjectDataKind
  label: string
  projectMfid: string
  projectScope: ProjectScope
}) {
  return (
    <Link
      activeOptions={{ exact: true, explicitUndefined: true }}
      aria-current={active ? "page" : undefined}
      className={buttonVariants({ variant: active ? "secondary" : "ghost" })}
      from="/projects/$projectMfid/"
      params={{ projectMfid }}
      search={(previous) => ({
        ...previous,
        dataFormat: kind === "samples" ? undefined : previous.dataFormat,
        dataFormatIsNull:
          kind === "samples" ? undefined : previous.dataFormatIsNull,
        dataFormatSet: kind === "samples" ? undefined : previous.dataFormatSet,
        datasetCursor: undefined,
        instrumentMfid:
          kind === "samples" ? undefined : previous.instrumentMfid,
        instrumentMfidIsNull:
          kind === "samples" ? undefined : previous.instrumentMfidIsNull,
        groupBy: undefined,
        groupValue: undefined,
        groupValueIsNull: undefined,
        groupValueSet: undefined,
        kind: kind === "samples" ? undefined : kind,
        measurement: kind === "samples" ? undefined : previous.measurement,
        measurementIsNull:
          kind === "samples" ? undefined : previous.measurementIsNull,
        measurementSet:
          kind === "samples" ? undefined : previous.measurementSet,
        preview: undefined,
        sampleCursor: undefined,
        sampleType: kind === "datasets" ? undefined : previous.sampleType,
        sampleTypeIsNull:
          kind === "datasets" ? undefined : previous.sampleTypeIsNull,
        sampleTypeSet: kind === "datasets" ? undefined : previous.sampleTypeSet,
        scope: projectScope === "all" ? undefined : projectScope,
        sessionName: kind === "samples" ? undefined : previous.sessionName,
        sessionNameIsNull:
          kind === "samples" ? undefined : previous.sessionNameIsNull,
        sessionNameSet:
          kind === "samples" ? undefined : previous.sessionNameSet,
      })}
      state={{}}
      to="/projects/$projectMfid"
    >
      {label}
    </Link>
  )
}

function ProjectDataLoadError({
  cursor,
  error,
  kind,
  projectMfid,
  retry,
}: {
  cursor: string | undefined
  error: Error
  kind: ProjectDataKind
  projectMfid: string
  retry: () => void
}) {
  const message =
    error instanceof HubApiClientError && error.details.kind === "forbidden"
      ? "You do not have permission to view this project data."
      : error instanceof HubApiClientError && error.details.kind === "conflict"
        ? "This project data selection could not be resolved."
        : "Project data could not be loaded."
  return (
    <div className="flex flex-col gap-4">
      <Empty className="min-h-state border" role="alert">
        <EmptyHeader>
          <EmptyTitle>{message}</EmptyTitle>
          <EmptyDescription>
            The selected project data filters remain unchanged.
          </EmptyDescription>
          <Button onClick={retry} variant="outline">
            Try again
          </Button>
        </EmptyHeader>
      </Empty>
      {cursor ? <FirstPageLink kind={kind} projectMfid={projectMfid} /> : null}
    </div>
  )
}

function FirstPageLink({
  kind,
  projectMfid,
}: {
  kind: ProjectDataKind
  projectMfid: string
}) {
  return (
    <nav className="flex justify-end" aria-label={`Project ${kind} pages`}>
      <Link
        className={buttonVariants({ variant: "outline" })}
        from="/projects/$projectMfid"
        params={{ projectMfid }}
        search={(previous) => ({
          ...previous,
          [kind === "samples" ? "sampleCursor" : "datasetCursor"]: undefined,
          preview: undefined,
        })}
        state={{}}
        to="/projects/$projectMfid"
      >
        First {kind}
      </Link>
    </nav>
  )
}
