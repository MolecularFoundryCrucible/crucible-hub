import { useMemo } from "react"
import {
  useInfiniteQuery,
  useIsFetching,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import {
  CollectionGroupControl,
  CollectionToolbar,
  DatasetCollectionBrowser,
  SampleCollectionBrowser,
} from "@/components/crucible/collection-browser"
import {
  CollectionLoadError,
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import { RefreshResourceIcon } from "@/components/crucible/icons"
import {
  datasetCollectionName,
  sampleCollectionName,
  useCursorResourceCollection,
} from "@/components/crucible/cursor-resource-collection"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceCollectionTable } from "@/components/crucible/resource-collection-table"
import {
  ResourcePreviewContext,
  resourcePreviewSearchSchema,
  useResourcePreviewNavigation,
} from "@/components/crucible/resource-preview-navigation"
import {
  resourceSiblingSequenceLabel,
  useRegisterResourceSiblings,
} from "@/components/crucible/resource-sibling-navigation"
import { ResourceCreationActions } from "@/components/crucible/resource-creation-actions"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { DataFilters } from "@/features/data/data-filters"
import {
  dataSearchSchema,
  resolveDataFilters,
  switchDataKind,
} from "@/features/data/data-filter-state"
import type {
  DataFilterValues,
  DataKindFilter,
  DataSearch,
} from "@/features/data/data-filter-state"
import {
  dataPageLimit,
  datasetsCursorQueryOptions,
  samplesCursorQueryOptions,
} from "@/data/crucible/data.queries"
import type { CollectionFilters } from "@/data/crucible/collection-filters"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import {
  collectionBrowseSearchState,
  collectionGroupOrderSearchState,
  clearCollectionGroupFilterSearch,
  datasetFiltersForGroup,
  facetOrderingForGroupOrder,
  globalDatasetBrowseOptions,
  globalSampleBrowseOptions,
  resolveCollectionBrowse,
  sampleFiltersForGroup,
} from "@/data/crucible/collection-browse"
import type { CollectionGroupOrder } from "@/data/crucible/collection-browse"
import type {
  CollectionQueryOptions,
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"
import { collectionOrderingSearchState } from "@/data/crucible/collection-query"
import type { ProjectScope } from "@/data/crucible/data.queries"
import type {
  DatasetFacetFilters,
  FacetSelection,
  DatasetFacetField,
  SampleFacetField,
  SampleFacetFilters,
} from "@/data/crucible/facets"
import {
  datasetFacetQueryOptions,
  sampleFacetQueryOptions,
} from "@/data/crucible/facets.queries"
import { ResourceInspector } from "@/features/resource-inspector/resource-inspector"

export const Route = createFileRoute("/_app/data")({
  head: () => ({ meta: [{ title: "Data | Crucible Hub" }] }),
  validateSearch: dataSearchSchema.merge(resourcePreviewSearchSchema),
  loaderDeps: ({ search }) => ({
    affiliation: search.affiliation,
    createdFrom: search.createdFrom,
    createdTo: search.createdTo,
    dataFormat: search.dataFormat,
    dataFormatIsNull: search.dataFormatIsNull,
    dataFormatSet: search.dataFormatSet,
    datasetCursor: search.datasetCursor,
    direction: search.direction,
    groupBy: search.groupBy,
    groupValue: search.groupValue,
    groupValueIsNull: search.groupValueIsNull,
    groupValueSet: search.groupValueSet,
    instrumentMfid: search.instrumentMfid,
    instrumentMfidIsNull: search.instrumentMfidIsNull,
    kind: search.kind,
    measurement: search.measurement,
    measurementIsNull: search.measurementIsNull,
    measurementSet: search.measurementSet,
    ownerId: search.ownerId,
    ownerIdIsNull: search.ownerIdIsNull,
    ownerIdSet: search.ownerIdSet,
    projectMfid: search.projectMfid,
    projectScope: search.projectScope,
    sampleCursor: search.sampleCursor,
    sampleType: search.sampleType,
    sampleTypeIsNull: search.sampleTypeIsNull,
    sampleTypeSet: search.sampleTypeSet,
    sessionName: search.sessionName,
    sessionNameIsNull: search.sessionNameIsNull,
    sessionNameSet: search.sessionNameSet,
    sort: search.sort,
    visibility: search.visibility,
    view: search.view,
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const resolution = resolveDataFilters(deps)
    if (!resolution.valid) return
    const baseFilters = collectionQueryFilters(resolution.filters)
    const sampleBrowse =
      resolution.filters.kind === "samples"
        ? resolveCollectionBrowse(deps, globalSampleBrowseOptions)
        : undefined
    const datasetBrowse =
      resolution.filters.kind === "datasets"
        ? resolveCollectionBrowse(deps, globalDatasetBrowseOptions)
        : undefined
    const hasGroupedSelection =
      (sampleBrowse?.view !== "grouped" ||
        sampleBrowse.selection.kind !== "all") &&
      (datasetBrowse?.view !== "grouped" ||
        datasetBrowse.selection.kind !== "all")

    const missing: Promise<void>[] = []
    if (resolution.filters.kind !== "datasets" && hasGroupedSelection) {
      const filters =
        sampleBrowse?.view === "grouped"
          ? sampleFiltersForGroup(
              baseFilters,
              sampleBrowse.field,
              sampleBrowse.selection
            )
          : baseFilters
      const options = samplesCursorQueryOptions(source.scope, {
        cursor: deps.sampleCursor,
        ...filters,
        limit: dataPageLimit,
      })
      const request = prefetchInfiniteQueryWithReadableCache(
        context.queryClient,
        options
      )
      if (request) missing.push(request)
    }
    if (resolution.filters.kind !== "samples" && hasGroupedSelection) {
      const filters =
        datasetBrowse?.view === "grouped"
          ? datasetFiltersForGroup(
              baseFilters,
              datasetBrowse.field,
              datasetBrowse.selection
            )
          : baseFilters
      const options = datasetsCursorQueryOptions(source.scope, {
        cursor: deps.datasetCursor,
        ...filters,
        limit: dataPageLimit,
      })
      const request = prefetchInfiniteQueryWithReadableCache(
        context.queryClient,
        options
      )
      if (request) missing.push(request)
    }
    if (cause !== "stay") await Promise.all(missing)
  },
  pendingComponent: DataRoutePending,
  staleTime: Infinity,
  component: DataPage,
})

function DataPage() {
  const search = Route.useSearch()
  const navigation = useResourcePreviewNavigation({
    kind: "data",
    preview: search.preview,
  })

  return (
    <ResourcePreviewContext.Provider value={navigation}>
      <PageLayout>
        <DataPageHeader />
        <DataCollection />
      </PageLayout>
      <ResourceInspector navigation={navigation} />
    </ResourcePreviewContext.Provider>
  )
}

function DataRoutePending() {
  const search = Route.useSearch()
  return (
    <PageLayout>
      <DataPageHeader />
      <div className="flex min-w-0 flex-col gap-4">
        <CollectionToolbar
          actions={<DataFilters errors={[]} values={search} />}
          primary={<DataTypeFilters kind={dataKind(search.kind)} />}
        />
        <CollectionTablePending label="data" presentation="resources" />
      </div>
    </PageLayout>
  )
}

function DataPageHeader() {
  return (
    <PageHeader
      actions={<ResourceCreationActions />}
      title="Samples and datasets"
    />
  )
}

function DataCollection() {
  const search = Route.useSearch()
  const resolution = resolveDataFilters(search)
  if (!resolution.valid) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <CollectionToolbar
          actions={<DataFilters errors={resolution.errors} values={search} />}
          primary={<DataTypeFilters kind={dataKind(search.kind)} />}
        />
        <Empty className="min-h-state border" role="alert">
          <EmptyHeader>
            <EmptyTitle>Data filters are not valid</EmptyTitle>
            <EmptyDescription>
              Correct or clear the filters before loading data.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return <DataResults filters={resolution.filters} search={search} />
}

function DataResults({
  filters,
  search,
}: {
  filters: DataFilterValues
  search: DataSearch
}) {
  const scope = useWorkspaceScope()
  const queryClient = useQueryClient()
  const navigate = Route.useNavigate()
  const kind = filters.kind
  const showSamples = kind === "samples"
  const showDatasets = kind === "datasets"
  const collectionFilters = collectionQueryFilters(filters)
  const sampleBrowse =
    kind === "samples"
      ? resolveCollectionBrowse(search, globalSampleBrowseOptions)
      : undefined
  const datasetBrowse =
    kind === "datasets"
      ? resolveCollectionBrowse(search, globalDatasetBrowseOptions)
      : undefined
  const sampleCollectionFilters =
    sampleBrowse?.view === "grouped"
      ? sampleFiltersForGroup(
          collectionFilters,
          sampleBrowse.field,
          sampleBrowse.selection
        )
      : collectionFilters
  const datasetCollectionFilters =
    datasetBrowse?.view === "grouped"
      ? datasetFiltersForGroup(
          collectionFilters,
          datasetBrowse.field,
          datasetBrowse.selection
        )
      : collectionFilters
  const displayedCollectionFilters =
    kind === "samples" ? sampleCollectionFilters : datasetCollectionFilters
  const loadSamples =
    showSamples &&
    (sampleBrowse?.view !== "grouped" || sampleBrowse.selection.kind !== "all")
  const loadDatasets =
    showDatasets &&
    (datasetBrowse?.view !== "grouped" ||
      datasetBrowse.selection.kind !== "all")
  const sampleResult = useInfiniteQuery({
    ...samplesCursorQueryOptions(scope, {
      cursor: search.sampleCursor,
      ...sampleCollectionFilters,
      limit: dataPageLimit,
    }),
    enabled: loadSamples,
  })
  const datasetResult = useInfiniteQuery({
    ...datasetsCursorQueryOptions(scope, {
      cursor: search.datasetCursor,
      ...datasetCollectionFilters,
      limit: dataPageLimit,
    }),
    enabled: loadDatasets,
  })
  const facetQueryKey =
    sampleBrowse?.view === "grouped"
      ? sampleFacetQueryOptions(scope, sampleBrowse.field, collectionFilters, {
          excludeField: false,
          ordering: facetOrderingForGroupOrder(
            sampleBrowse.order,
            sampleBrowse.direction
          ),
        }).queryKey
      : datasetBrowse?.view === "grouped"
        ? datasetFacetQueryOptions(
            scope,
            datasetBrowse.field,
            collectionFilters,
            {
              excludeField: false,
              ordering: facetOrderingForGroupOrder(
                datasetBrowse.order,
                datasetBrowse.direction
              ),
            }
          ).queryKey
        : undefined
  const facetFetching = useIsFetching({
    exact: true,
    queryKey: facetQueryKey ?? ["inactive-data-facets"],
  })

  const sampleCollection = useCursorResourceCollection({
    getName: sampleCollectionName,
    kind: "sample",
    label: resourceSiblingSequenceLabel({
      filters: sampleCollectionFilters,
      kind: "sample",
    }),
    query: sampleResult,
  })
  const datasetCollection = useCursorResourceCollection({
    getName: datasetCollectionName,
    kind: "dataset",
    label: resourceSiblingSequenceLabel({
      filters: datasetCollectionFilters,
      kind: "dataset",
    }),
    query: datasetResult,
  })
  const sampleItems = sampleCollection.items
  const datasetItems = datasetCollection.items
  const samplePage = sampleResult.data
    ? { items: sampleItems, total: sampleCollection.total }
    : undefined
  const datasetPage = datasetResult.data
    ? { items: datasetItems, total: datasetCollection.total }
    : undefined
  const siblingCollections = useMemo(
    () => [
      ...(loadSamples && sampleResult.data
        ? [sampleCollection.siblingCollection]
        : []),
      ...(loadDatasets && datasetResult.data
        ? [datasetCollection.siblingCollection]
        : []),
    ],
    [
      datasetCollection.siblingCollection,
      datasetResult.data,
      loadDatasets,
      loadSamples,
      sampleCollection.siblingCollection,
      sampleResult.data,
    ]
  )
  useRegisterResourceSiblings(siblingCollections)
  const samplePending = loadSamples && sampleResult.isPending
  const datasetPending = loadDatasets && datasetResult.isPending
  const hasReadableData = Boolean(
    (showSamples && samplePage) || (showDatasets && datasetPage)
  )
  const hasRows = Boolean(
    (showSamples && samplePage?.items.length) ||
    (showDatasets && datasetPage?.items.length)
  )
  const hasActiveFilters = Boolean(
    filters.createdFrom ||
    filters.createdTo ||
    filters.dataFormat !== undefined ||
    filters.dataFormatIsNull ||
    filters.instrumentMfid ||
    filters.instrumentMfidIsNull ||
    filters.ownerId !== undefined ||
    filters.ownerIdIsNull ||
    filters.projectMfid ||
    filters.measurement !== undefined ||
    filters.measurementIsNull ||
    filters.sampleType !== undefined ||
    filters.sampleTypeIsNull ||
    filters.sessionName !== undefined ||
    filters.sessionNameIsNull ||
    filters.visibility ||
    filters.affiliation
  )
  const updating =
    (showSamples &&
      sampleResult.isFetching &&
      !sampleResult.isFetchingNextPage) ||
    (showDatasets &&
      datasetResult.isFetching &&
      !datasetResult.isFetchingNextPage)
  const refreshing = updating || facetFetching > 0

  function retrySelected() {
    if (showSamples) void sampleResult.refetch()
    if (showDatasets) void datasetResult.refetch()
  }

  function refreshVisibleData() {
    if (loadSamples) void sampleResult.refetch()
    if (loadDatasets) void datasetResult.refetch()
    if (facetQueryKey) {
      void queryClient.refetchQueries({ exact: true, queryKey: facetQueryKey })
    }
  }

  function changeSort(sort: ResourceSort, direction: SortDirection) {
    const ordering = collectionOrderingSearchState(sort, direction)
    void navigate({
      search: (previous) => ({
        ...previous,
        datasetCursor: undefined,
        direction: ordering.direction,
        preview: undefined,
        sampleCursor: undefined,
        sort: ordering.sort,
      }),
      state: {},
      to: "/data",
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CollectionUpdateStatus
        label="data"
        updating={hasReadableData && updating}
      />
      <DataBrowseFrame
        datasetBrowse={datasetBrowse}
        filters={collectionFilters}
        sampleBrowse={sampleBrowse}
        refreshAction={
          <Button
            aria-label="Refresh data"
            aria-pressed={refreshing || undefined}
            className={refreshing ? "translate-y-px" : undefined}
            onClick={refreshVisibleData}
            variant="outline"
          >
            <RefreshResourceIcon
              aria-hidden="true"
              className={
                refreshing
                  ? "animate-spin motion-reduce:animate-none"
                  : undefined
              }
              data-icon="inline-start"
            />
            Refresh
          </Button>
        }
        toolbarActions={<DataFilters errors={[]} values={search} />}
        toolbarPrimary={
          <DataTypeFilters
            datasetLabel={collectionLabel("Datasets", datasetPage)}
            kind={kind}
            sampleLabel={collectionLabel("Samples", samplePage)}
          />
        }
      >
        {!hasReadableData && (samplePending || datasetPending) ? (
          <CollectionTablePending label="data" presentation="resources" />
        ) : !hasReadableData ? (
          <CollectionLoadError label="Data" retry={retrySelected} />
        ) : (
          <>
            {showSamples &&
            sampleResult.isError &&
            !sampleResult.isFetchNextPageError ? (
              <CollectionUpdateError
                label="Samples"
                preserved={Boolean(samplePage)}
                retry={() => void sampleResult.refetch()}
              />
            ) : null}
            {showDatasets &&
            datasetResult.isError &&
            !datasetResult.isFetchNextPageError ? (
              <CollectionUpdateError
                label="Datasets"
                preserved={Boolean(datasetPage)}
                retry={() => void datasetResult.refetch()}
              />
            ) : null}

            {hasRows ? (
              <Card aria-busy={updating}>
                <CardContent className="px-0">
                  {showSamples && samplePage ? (
                    <ResourceCollectionTable
                      direction={displayedCollectionFilters.direction ?? "desc"}
                      items={samplePage.items}
                      kind="sample"
                      onSort={changeSort}
                      showSubtypeColumn
                      sort={displayedCollectionFilters.sort}
                      subtypeLabel="Type"
                      subtypeVisibility="compact"
                    />
                  ) : null}
                  {showDatasets && datasetPage ? (
                    <ResourceCollectionTable
                      direction={displayedCollectionFilters.direction ?? "desc"}
                      items={datasetPage.items}
                      kind="dataset"
                      onSort={changeSort}
                      showSubtypeColumn
                      sort={displayedCollectionFilters.sort}
                      subtypeLabel="Type"
                      subtypeVisibility="compact"
                    />
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <Empty className="min-h-state border">
                <EmptyHeader>
                  <EmptyTitle>
                    {hasActiveFilters
                      ? `No ${kind} match these filters`
                      : `No ${kind} are available`}
                  </EmptyTitle>
                  <EmptyDescription>
                    {hasActiveFilters
                      ? "Try changing the filters or data type."
                      : "New resources will appear here when they are available."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </>
        )}
        {showSamples && samplePage ? (
          <CollectionPagination
            disabled={
              sampleResult.isFetching && !sampleResult.isFetchingNextPage
            }
            hasNextPage={Boolean(sampleResult.hasNextPage)}
            isError={sampleResult.isFetchNextPageError}
            isLoading={sampleResult.isFetchingNextPage}
            label="samples"
            loaded={sampleItems.length}
            onLoadMore={() => void sampleResult.fetchNextPage()}
            total={samplePage.total}
          />
        ) : null}
        {showDatasets && datasetPage ? (
          <CollectionPagination
            disabled={
              datasetResult.isFetching && !datasetResult.isFetchingNextPage
            }
            hasNextPage={Boolean(datasetResult.hasNextPage)}
            isError={datasetResult.isFetchNextPageError}
            isLoading={datasetResult.isFetchingNextPage}
            label="datasets"
            loaded={datasetItems.length}
            onLoadMore={() => void datasetResult.fetchNextPage()}
            total={datasetPage.total}
          />
        ) : null}
      </DataBrowseFrame>
    </div>
  )
}

type DataBrowseState<TField extends string> = {
  direction: SortDirection
  field: TField
  order: CollectionGroupOrder
  selection: FacetSelection
  view: "grouped" | "list"
}

function DataBrowseFrame({
  children,
  datasetBrowse,
  filters,
  refreshAction,
  sampleBrowse,
  toolbarActions,
  toolbarPrimary,
}: {
  children: React.ReactNode
  datasetBrowse?: DataBrowseState<DatasetFacetField>
  filters: DataCollectionQueryFilters
  refreshAction: React.ReactNode
  sampleBrowse?: DataBrowseState<SampleFacetField>
  toolbarActions: React.ReactNode
  toolbarPrimary: React.ReactNode
}) {
  const navigate = Route.useNavigate()
  const browse = sampleBrowse ?? datasetBrowse
  if (!browse) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <CollectionToolbar
          actions={
            <>
              {toolbarActions}
              {refreshAction}
            </>
          }
          primary={toolbarPrimary}
        />
        {children}
      </div>
    )
  }
  const browseField = browse.field

  function changeGroup(
    field: DatasetFacetField | SampleFacetField | undefined
  ) {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...collectionBrowseSearchState({ kind: "all" }),
        ...clearCollectionGroupFilterSearch(field ?? browseField),
        datasetCursor: undefined,
        groupBy: field,
        preview: undefined,
        sampleCursor: undefined,
        view: field ? "grouped" : undefined,
      }),
      state: {},
      to: "/data",
    })
  }

  function selectGroup(selection: FacetSelection) {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...collectionBrowseSearchState(selection),
        ...clearCollectionGroupFilterSearch(browseField),
        datasetCursor: undefined,
        preview: undefined,
        sampleCursor: undefined,
      }),
      state: {},
      to: "/data",
    })
  }

  function changeGroupOrder(
    order: CollectionGroupOrder,
    direction: SortDirection
  ) {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...collectionGroupOrderSearchState(order, direction),
      }),
      state: {},
      to: "/data",
    })
  }

  if (sampleBrowse) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <CollectionToolbar
          actions={
            <>
              {toolbarActions}
              <CollectionGroupControl
                field={sampleBrowse.field}
                id="data-sample-group-field"
                onChange={changeGroup}
                options={globalSampleBrowseOptions}
                view={sampleBrowse.view}
              />
              {refreshAction}
            </>
          }
          primary={toolbarPrimary}
        />
        {sampleBrowse.view === "grouped" ? (
          <SampleCollectionBrowser
            direction={sampleBrowse.direction}
            field={sampleBrowse.field}
            filters={filters}
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
      <CollectionToolbar
        actions={
          <>
            {toolbarActions}
            <CollectionGroupControl
              field={datasetBrowse.field}
              id="data-dataset-group-field"
              onChange={changeGroup}
              options={globalDatasetBrowseOptions}
              view={datasetBrowse.view}
            />
            {refreshAction}
          </>
        }
        primary={toolbarPrimary}
      />
      {datasetBrowse.view === "grouped" ? (
        <DatasetCollectionBrowser
          direction={datasetBrowse.direction}
          field={datasetBrowse.field}
          filters={filters}
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

function collectionLabel(
  label: string,
  page: { items: readonly unknown[]; total: number | null } | undefined
) {
  return page?.total == null ? label : `${label} (${page.total})`
}

function DataTypeFilters({
  datasetLabel = "Datasets",
  kind,
  sampleLabel = "Samples",
}: {
  datasetLabel?: string
  kind: DataKindFilter
  sampleLabel?: string
}) {
  const navigate = Route.useNavigate()
  const options = [
    { label: sampleLabel, value: "samples" },
    { label: datasetLabel, value: "datasets" },
  ] as const

  return (
    <SegmentedControl
      ariaLabel="Data type filter"
      onValueChange={(nextKind) => {
        void navigate({
          search: (previous) => switchDataKind(previous, nextKind),
          state: {},
          to: "/data",
        })
      }}
      options={options}
      value={kind}
    />
  )
}

function dataKind(kind: string | undefined): DataKindFilter {
  return kind === "datasets" ? "datasets" : "samples"
}

type DataCollectionQueryFilters = CollectionFilters &
  CollectionQueryOptions &
  DatasetFacetFilters &
  SampleFacetFilters & { instrumentMfid?: string } & (
    | {
        projectMfid?: undefined
        projectMfidIsNull?: undefined
        projectScope?: undefined
      }
    | {
        projectMfid: string
        projectMfidIsNull?: undefined
        projectScope: ProjectScope
      }
    | {
        projectMfid?: undefined
        projectMfidIsNull: true
        projectScope?: undefined
      }
  )

function collectionQueryFilters(
  filters: DataFilterValues
): DataCollectionQueryFilters {
  const collectionFilters: CollectionFilters = {
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
    visibility: filters.visibility,
  }
  const collectionQuery: CollectionQueryOptions = {
    affiliation: filters.affiliation,
    direction: filters.direction,
    sort: filters.sort,
  }
  const facetFilters: DatasetFacetFilters & SampleFacetFilters = {
    dataFormat: filters.dataFormat,
    dataFormatIsNull: filters.dataFormatIsNull,
    instrumentMfidIsNull: filters.instrumentMfidIsNull,
    measurement: filters.measurement,
    measurementIsNull: filters.measurementIsNull,
    ownerId: filters.ownerId,
    ownerIdIsNull: filters.ownerIdIsNull,
    sampleType: filters.sampleType,
    sampleTypeIsNull: filters.sampleTypeIsNull,
    sessionName: filters.sessionName,
    sessionNameIsNull: filters.sessionNameIsNull,
  }
  const instrumentFilter = filters.instrumentMfid
    ? { instrumentMfid: filters.instrumentMfid }
    : {}
  return filters.projectMfid
    ? {
        ...collectionFilters,
        ...collectionQuery,
        ...facetFilters,
        ...instrumentFilter,
        projectMfid: filters.projectMfid,
        projectScope: filters.projectScope,
      }
    : {
        ...collectionFilters,
        ...collectionQuery,
        ...facetFilters,
        ...instrumentFilter,
      }
}
