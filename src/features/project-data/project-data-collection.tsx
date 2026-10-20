import { useMemo } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
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
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import {
  datasetCollectionName,
  sampleCollectionName,
  useCursorResourceCollection,
} from "@/components/crucible/cursor-resource-collection"
import {
  collectionBrowseSearchState,
  collectionGroupOrderSearchState,
  clearCollectionGroupFilterSearch,
  datasetFiltersForGroup,
  projectDatasetBrowseOptions,
  projectSampleBrowseOptions,
  resolveCollectionBrowse,
  sampleFiltersForGroup,
} from "@/data/crucible/collection-browse"
import type {
  CollectionBrowseSearch,
  CollectionGroupOrder,
} from "@/data/crucible/collection-browse"
import { ResourceCollectionTable } from "@/components/crucible/resource-collection-table"
import {
  resourceSiblingSequenceLabel,
  useRegisterResourceSiblings,
} from "@/components/crucible/resource-sibling-navigation"
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
  dataPageLimit,
  datasetsCursorQueryOptions,
  samplesCursorQueryOptions,
} from "@/data/crucible/data.queries"
import type { ProjectScope } from "@/data/crucible/data.queries"
import type {
  DatasetFacetField,
  FacetSelection,
  SampleFacetField,
} from "@/data/crucible/facets"
import type {
  CollectionOrdering,
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"
import {
  collectionOrderingSearchState,
  defaultCollectionOrdering,
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
import type { DataGroupBy } from "@/features/preferences/data-group-by"

export type ProjectDataKind = "datasets" | "samples"

export function ProjectDataCollection({
  browseSearch,
  cursor,
  dataGroupBy,
  defaultOrdering = defaultCollectionOrdering,
  filterResolution,
  filterValues,
  kind,
  projectMfid,
  projectScope,
}: {
  browseSearch: CollectionBrowseSearch
  cursor: string | undefined
  dataGroupBy: DataGroupBy | undefined
  defaultOrdering?: CollectionOrdering
  filterResolution: ProjectDataFilterResolution
  filterValues: ProjectDataFilterSearch
  kind: ProjectDataKind
  projectMfid: string
  projectScope: ProjectScope
}) {
  const navigate = useNavigate({ from: "/projects/$projectMfid" })
  const sampleBrowse =
    kind === "samples"
      ? resolveCollectionBrowse(
          browseSearch,
          projectSampleBrowseOptions,
          dataGroupBy?.samples
        )
      : undefined
  const datasetBrowse =
    kind === "datasets"
      ? resolveCollectionBrowse(
          browseSearch,
          projectDatasetBrowseOptions,
          dataGroupBy?.datasets
        )
      : undefined
  const onSort = (sort: ResourceSort, direction: SortDirection) => {
    const ordering = collectionOrderingSearchState(
      sort,
      direction,
      defaultOrdering
    )
    void navigate({
      params: { projectMfid },
      search: (previous) => ({
        ...previous,
        datasetCursor: undefined,
        direction: ordering.direction,
        preview: undefined,
        sampleCursor: undefined,
        sort: ordering.sort,
      }),
      state: {},
      to: "/projects/$projectMfid",
    })
  }
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
            defaultOrdering={defaultOrdering}
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

export function ProjectDataCollectionPending({
  browseSearch,
  filterResolution,
  filterValues,
  kind,
  projectMfid,
  projectScope,
}: {
  browseSearch: CollectionBrowseSearch
  filterResolution: ProjectDataFilterResolution
  filterValues: ProjectDataFilterSearch
  kind: ProjectDataKind
  projectMfid: string
  projectScope: ProjectScope
}) {
  const sampleBrowse =
    kind === "samples"
      ? resolveCollectionBrowse(browseSearch, projectSampleBrowseOptions)
      : undefined
  const datasetBrowse =
    kind === "datasets"
      ? resolveCollectionBrowse(browseSearch, projectDatasetBrowseOptions)
      : undefined
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ProjectBrowseFrame
        datasetBrowse={datasetBrowse}
        filters={undefined}
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
        <CollectionTablePending
          label={kind}
          presentation="resources-scoped"
          subtypeLabel={kind === "samples" ? "Sample type" : "Measurement"}
        />
      </ProjectBrowseFrame>
    </div>
  )
}

type ProjectBrowseState<TField extends string> = {
  direction: SortDirection
  field: TField
  order: CollectionGroupOrder
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
      view: field ? "grouped" : "list",
    })
  }

  function selectGroup(selection: FacetSelection) {
    updateSearch({
      ...collectionBrowseSearchState(selection),
      ...clearCollectionGroupFilterSearch(browseField),
    })
  }

  function changeGroupOrder(
    order: CollectionGroupOrder,
    direction: SortDirection
  ) {
    void navigate({
      params: { projectMfid },
      search: (previous) => ({
        ...previous,
        ...collectionGroupOrderSearchState(order, direction),
      }),
      state: {},
      to: "/projects/$projectMfid",
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
            direction={sampleBrowse.direction}
            field={sampleBrowse.field}
            filters={facetFilters}
            onOrderChange={changeGroupOrder}
            order={sampleBrowse.order}
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
          direction={datasetBrowse.direction}
          field={datasetBrowse.field}
          filters={facetFilters}
          onOrderChange={changeGroupOrder}
          order={datasetBrowse.order}
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
  const result = useInfiniteQuery(
    samplesCursorQueryOptions(scope, {
      cursor,
      ...filters,
      limit: dataPageLimit,
      projectMfid,
      projectScope,
    })
  )

  const collection = useCursorResourceCollection({
    getName: sampleCollectionName,
    kind: "sample",
    label: resourceSiblingSequenceLabel({
      filters,
      kind: "sample",
      scope: "project",
    }),
    query: result,
  })
  const items = collection.items
  const total = collection.total
  const siblingCollections = useMemo(
    () => [collection.siblingCollection],
    [collection.siblingCollection]
  )
  useRegisterResourceSiblings(siblingCollections)

  if (result.isPending) {
    return (
      <CollectionTablePending
        label="samples"
        presentation="resources-scoped"
        subtypeLabel="Sample type"
      />
    )
  }
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
      direction={filters.direction}
      error={result.isError && !result.isFetchNextPageError}
      hasNextPage={Boolean(result.hasNextPage)}
      isPaginationDisabled={result.isFetching && !result.isFetchingNextPage}
      isLoadingMore={result.isFetchingNextPage}
      items={items}
      kind="samples"
      loadMoreError={result.isFetchNextPageError}
      onLoadMore={() => void result.fetchNextPage()}
      onSort={onSort}
      projectMfid={projectMfid}
      retry={() => void result.refetch()}
      sort={filters.sort}
      total={total}
      updating={result.isFetching && !result.isFetchingNextPage}
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
  const result = useInfiniteQuery(
    datasetsCursorQueryOptions(scope, {
      cursor,
      ...filters,
      limit: dataPageLimit,
      projectMfid,
      projectScope,
    })
  )

  const collection = useCursorResourceCollection({
    getName: datasetCollectionName,
    kind: "dataset",
    label: resourceSiblingSequenceLabel({
      filters,
      kind: "dataset",
      scope: "project",
    }),
    query: result,
  })
  const items = collection.items
  const total = collection.total
  const siblingCollections = useMemo(
    () => [collection.siblingCollection],
    [collection.siblingCollection]
  )
  useRegisterResourceSiblings(siblingCollections)

  if (result.isPending) {
    return (
      <CollectionTablePending
        label="datasets"
        presentation="resources-scoped"
        subtypeLabel="Measurement"
      />
    )
  }
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
      direction={filters.direction}
      error={result.isError && !result.isFetchNextPageError}
      hasNextPage={Boolean(result.hasNextPage)}
      isPaginationDisabled={result.isFetching && !result.isFetchingNextPage}
      isLoadingMore={result.isFetchingNextPage}
      items={items}
      kind="datasets"
      loadMoreError={result.isFetchNextPageError}
      onLoadMore={() => void result.fetchNextPage()}
      onSort={onSort}
      projectMfid={projectMfid}
      retry={() => void result.refetch()}
      sort={filters.sort}
      total={total}
      updating={result.isFetching && !result.isFetchingNextPage}
    />
  )
}

function ProjectDataResult({
  cursor,
  direction,
  error,
  hasNextPage,
  isPaginationDisabled,
  isLoadingMore,
  items,
  kind,
  loadMoreError,
  onLoadMore,
  onSort,
  projectMfid,
  retry,
  sort,
  total,
  updating,
}:
  | {
      cursor: string | undefined
      direction: SortDirection
      error: boolean
      hasNextPage: boolean
      isPaginationDisabled: boolean
      isLoadingMore: boolean
      items: readonly WorkspaceSample[]
      kind: "samples"
      loadMoreError: boolean
      onLoadMore: () => void
      onSort: (sort: ResourceSort, direction: SortDirection) => void
      projectMfid: string
      retry: () => void
      sort: ResourceSort | undefined
      total: number | null
      updating: boolean
    }
  | {
      cursor: string | undefined
      direction: SortDirection
      error: boolean
      hasNextPage: boolean
      isPaginationDisabled: boolean
      isLoadingMore: boolean
      items: readonly WorkspaceDataset[]
      kind: "datasets"
      loadMoreError: boolean
      onLoadMore: () => void
      onSort: (sort: ResourceSort, direction: SortDirection) => void
      projectMfid: string
      retry: () => void
      sort: ResourceSort | undefined
      total: number | null
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
              <ResourceCollectionTable
                direction={direction}
                fromProject={projectMfid}
                items={items}
                kind="sample"
                onSort={onSort}
                showProjectColumn={false}
                showSubtypeColumn
                sort={sort}
                subtypeVisibility="compact"
              />
            ) : (
              <ResourceCollectionTable
                direction={direction}
                fromProject={projectMfid}
                items={items}
                kind="dataset"
                onSort={onSort}
                showProjectColumn={false}
                showSubtypeColumn
                sort={sort}
                subtypeVisibility="compact"
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
      <CollectionPagination
        disabled={isPaginationDisabled}
        hasNextPage={hasNextPage}
        isError={loadMoreError}
        isLoading={isLoadingMore}
        label={kind}
        loaded={items.length}
        onLoadMore={onLoadMore}
        total={total}
      />
      {cursor && !hasNextPage && !items.length ? (
        <FirstPageLink kind={kind} projectMfid={projectMfid} />
      ) : null}
    </div>
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
      className={buttonVariants({ variant: "ghost" })}
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
  const forbidden =
    error instanceof HubApiClientError && error.details.kind === "forbidden"
  const message = forbidden
    ? "You do not have permission to view this project data."
    : error instanceof HubApiClientError && error.details.kind === "conflict"
      ? "This project data selection could not be resolved."
      : "Project data could not be loaded."
  return (
    <div className="flex flex-col gap-4">
      <Empty className="min-h-state border" role="alert">
        <EmptyHeader>
          <EmptyTitle>{message}</EmptyTitle>
          {forbidden ? null : (
            <Button onClick={retry} variant="outline">
              Try again
            </Button>
          )}
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
