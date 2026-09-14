import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

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
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import {
  ResourceOpenCell,
  ResourceOwnerCell,
  ResourceProjectCell,
  ResourceUpdatedCell,
} from "@/components/crucible/resource-collection-cells"
import { ResourceCollectionNameCell } from "@/components/crucible/resource-collection-name-cell"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import {
  ResourcePreviewContext,
  resourcePreviewSearchSchema,
  useResourcePreviewNavigation,
} from "@/components/crucible/resource-preview-navigation"
import { ResourceCreationActions } from "@/components/crucible/resource-creation-actions"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { buttonVariants } from "@/components/ui/button"
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  datasetsQueryOptions,
  samplesQueryOptions,
} from "@/data/crucible/data.queries"
import type { CollectionFilters } from "@/data/crucible/collection-filters"
import {
  collectionBrowseSearchState,
  clearCollectionGroupFilterSearch,
  datasetFiltersForGroup,
  globalDatasetBrowseOptions,
  globalSampleBrowseOptions,
  resolveCollectionBrowse,
  sampleFiltersForGroup,
} from "@/data/crucible/collection-browse"
import type {
  CollectionQueryOptions,
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"
import type { ProjectScope } from "@/data/crucible/data.queries"
import type {
  DatasetFacetFilters,
  FacetSelection,
  DatasetFacetField,
  SampleFacetField,
  SampleFacetFilters,
} from "@/data/crucible/facets"
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
      const options = samplesQueryOptions(source.scope, {
        cursor: deps.sampleCursor,
        ...filters,
        limit: dataPageLimit,
      })
      const hasData =
        context.queryClient.getQueryData(options.queryKey) !== undefined
      const request = context.queryClient.prefetchQuery(options)
      if (!hasData) missing.push(request)
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
      const options = datasetsQueryOptions(source.scope, {
        cursor: deps.datasetCursor,
        ...filters,
        limit: dataPageLimit,
      })
      const hasData =
        context.queryClient.getQueryData(options.queryKey) !== undefined
      const request = context.queryClient.prefetchQuery(options)
      if (!hasData) missing.push(request)
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
  return (
    <PageLayout>
      <DataPageHeader />
      <CollectionTablePending label="data" />
    </PageLayout>
  )
}

function DataPageHeader() {
  return (
    <PageHeader
      actions={<ResourceCreationActions />}
      eyebrow="Data"
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
  const navigate = Route.useNavigate()
  const kind = filters.kind
  const showSamples = kind === "all" || kind === "samples"
  const showDatasets = kind === "all" || kind === "datasets"
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
  const sampleResult = useQuery({
    ...samplesQueryOptions(scope, {
      cursor: search.sampleCursor,
      ...sampleCollectionFilters,
      limit: dataPageLimit,
    }),
    enabled: loadSamples,
  })
  const datasetResult = useQuery({
    ...datasetsQueryOptions(scope, {
      cursor: search.datasetCursor,
      ...datasetCollectionFilters,
      limit: dataPageLimit,
    }),
    enabled: loadDatasets,
  })

  const samplePage = sampleResult.data
  const datasetPage = datasetResult.data
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
    filters.affiliation ||
    filters.sort
  )
  const updating =
    (showSamples && sampleResult.isFetching) ||
    (showDatasets && datasetResult.isFetching)

  function retrySelected() {
    if (showSamples) void sampleResult.refetch()
    if (showDatasets) void datasetResult.refetch()
  }

  function changeSort(sort: ResourceSort, direction: SortDirection) {
    void navigate({
      search: (previous) => ({
        ...previous,
        datasetCursor: undefined,
        direction,
        preview: undefined,
        sampleCursor: undefined,
        sort,
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
          <CollectionTablePending label="data" />
        ) : !hasReadableData ? (
          <CollectionLoadError label="Data" retry={retrySelected} />
        ) : (
          <>
            {showSamples && sampleResult.isError ? (
              <CollectionUpdateError
                label="Samples"
                preserved={Boolean(samplePage)}
                retry={() => void sampleResult.refetch()}
              />
            ) : null}
            {showDatasets && datasetResult.isError ? (
              <CollectionUpdateError
                label="Datasets"
                preserved={Boolean(datasetPage)}
                retry={() => void datasetResult.refetch()}
              />
            ) : null}

            {hasRows ? (
              <Card aria-busy={updating}>
                <CardContent className="px-0">
                  <Table className="resource-collection-table table-fixed">
                    <colgroup>
                      <col className="w-data-name-column-with-action xl:w-data-name-column-wide-with-action" />
                      <col className="hidden xl:table-column xl:w-data-type-column-wide-with-action" />
                      <col className="w-data-project-column-with-action xl:w-data-project-column-wide-with-action" />
                      <col className="w-data-owner-column-with-action xl:w-data-owner-column-wide-with-action" />
                      <col className="w-data-date-column-with-action xl:w-data-date-column-wide-with-action" />
                      <col className="w-data-action-column" />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        {kind === "all" ? (
                          <TableHead>Name</TableHead>
                        ) : (
                          <SortableTableHead
                            active={displayedCollectionFilters.sort === "name"}
                            direction={
                              displayedCollectionFilters.direction ?? "desc"
                            }
                            field="name"
                            label="Name"
                            onChange={changeSort}
                          />
                        )}
                        <TableHead className="hidden xl:table-cell">
                          Type
                        </TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Owner</TableHead>
                        {kind === "all" ? (
                          <TableHead>Updated</TableHead>
                        ) : (
                          <SortableTableHead
                            active={
                              displayedCollectionFilters.sort === "updated"
                            }
                            direction={
                              displayedCollectionFilters.direction ?? "desc"
                            }
                            field="updated"
                            label="Updated"
                            onChange={changeSort}
                          />
                        )}
                        <TableHead className="text-center">
                          <span className="sr-only">Open</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {showSamples &&
                        samplePage?.items.map((sample) => (
                          <TableRow key={sample.unique_id}>
                            <ResourceCollectionNameCell
                              className="resource-collection-name"
                              kind="sample"
                              mfid={sample.unique_id}
                              name={sample.sample_name}
                              subtype={
                                sample.sample_type ?? "Unspecified sample type"
                              }
                              subtypeVisibility="compact"
                            />
                            <TableCell className="resource-collection-type hidden xl:table-cell">
                              <span
                                className="block truncate"
                                title={sample.sample_type ?? undefined}
                              >
                                {sample.sample_type ?? "Unspecified"}
                              </span>
                            </TableCell>
                            <ResourceProjectCell
                              project={sample.project}
                              projectId={sample.project_id}
                              relation={sample.project_relation}
                            />
                            <ResourceOwnerCell owner={sample.owner} />
                            <ResourceUpdatedCell
                              value={
                                sample.modification_time ?? sample.creation_time
                              }
                            />
                            <ResourceOpenCell
                              kind="sample"
                              mfid={sample.unique_id}
                              name={sample.sample_name}
                            />
                          </TableRow>
                        ))}
                      {showDatasets &&
                        datasetPage?.items.map((dataset) => (
                          <TableRow key={dataset.unique_id}>
                            <ResourceCollectionNameCell
                              className="resource-collection-name"
                              kind="dataset"
                              mfid={dataset.unique_id}
                              name={dataset.dataset_name ?? "Untitled dataset"}
                              subtype={
                                dataset.measurement ?? "Unspecified measurement"
                              }
                              subtypeVisibility="compact"
                            />
                            <TableCell className="resource-collection-type hidden xl:table-cell">
                              <span
                                className="block truncate"
                                title={dataset.measurement ?? undefined}
                              >
                                {dataset.measurement ?? "Unspecified"}
                              </span>
                            </TableCell>
                            <ResourceProjectCell
                              project={dataset.project}
                              projectId={dataset.project_id}
                              relation={dataset.project_relation}
                            />
                            <ResourceOwnerCell owner={dataset.owner} />
                            <ResourceUpdatedCell
                              value={
                                dataset.modification_time ??
                                dataset.creation_time
                              }
                            />
                            <ResourceOpenCell
                              kind="dataset"
                              mfid={dataset.unique_id}
                              name={dataset.dataset_name ?? "Untitled dataset"}
                            />
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Empty className="min-h-state border">
                <EmptyHeader>
                  <EmptyTitle>
                    {hasActiveFilters
                      ? `No ${kind === "all" ? "data" : kind} match these filters`
                      : `No ${kind === "all" ? "data are" : `${kind} are`} available`}
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
        {!updating &&
        ((showSamples && samplePage?.nextCursor) ||
          (showDatasets && datasetPage?.nextCursor)) ? (
          <nav
            className="flex flex-wrap items-center justify-end gap-2"
            aria-label="Data pages"
          >
            {showSamples && samplePage?.nextCursor && (
              <Link
                className={buttonVariants({ variant: "outline" })}
                from="/data"
                search={(previous) => ({
                  ...previous,
                  preview: undefined,
                  sampleCursor: samplePage.nextCursor ?? undefined,
                })}
                state={{}}
                to="/data"
              >
                Next samples
              </Link>
            )}
            {showDatasets && datasetPage?.nextCursor && (
              <Link
                className={buttonVariants({ variant: "outline" })}
                from="/data"
                search={(previous) => ({
                  ...previous,
                  datasetCursor: datasetPage.nextCursor ?? undefined,
                  preview: undefined,
                })}
                state={{}}
                to="/data"
              >
                Next datasets
              </Link>
            )}
          </nav>
        ) : null}
      </DataBrowseFrame>
    </div>
  )
}

type DataBrowseState<TField extends string> = {
  field: TField
  selection: FacetSelection
  view: "grouped" | "list"
}

function DataBrowseFrame({
  children,
  datasetBrowse,
  filters,
  sampleBrowse,
  toolbarActions,
  toolbarPrimary,
}: {
  children: React.ReactNode
  datasetBrowse?: DataBrowseState<DatasetFacetField>
  filters: DataCollectionQueryFilters
  sampleBrowse?: DataBrowseState<SampleFacetField>
  toolbarActions: React.ReactNode
  toolbarPrimary: React.ReactNode
}) {
  const navigate = Route.useNavigate()
  const browse = sampleBrowse ?? datasetBrowse
  if (!browse) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <CollectionToolbar actions={toolbarActions} primary={toolbarPrimary} />
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
            </>
          }
          primary={toolbarPrimary}
        />
        {sampleBrowse.view === "grouped" ? (
          <SampleCollectionBrowser
            field={sampleBrowse.field}
            filters={filters}
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
          </>
        }
        primary={toolbarPrimary}
      />
      {datasetBrowse.view === "grouped" ? (
        <DatasetCollectionBrowser
          field={datasetBrowse.field}
          filters={filters}
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
  return (
    <div className="flex flex-wrap gap-2" aria-label="Data type filter">
      <FilterLink active={kind === "all"} kind="all" label="All data" />
      <FilterLink
        active={kind === "samples"}
        kind="samples"
        label={sampleLabel}
      />
      <FilterLink
        active={kind === "datasets"}
        kind="datasets"
        label={datasetLabel}
      />
    </div>
  )
}

function FilterLink({
  active,
  kind,
  label,
}: {
  active: boolean
  kind: "all" | "datasets" | "samples"
  label: string
}) {
  return (
    <Link
      className={buttonVariants({
        variant: active ? "secondary" : "ghost",
      })}
      from="/data"
      to="/data"
      search={(previous) => switchDataKind(previous, kind)}
      state={{}}
    >
      {label}
    </Link>
  )
}

function dataKind(kind: string | undefined): DataKindFilter {
  return kind === "datasets" || kind === "samples" ? kind : "all"
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
