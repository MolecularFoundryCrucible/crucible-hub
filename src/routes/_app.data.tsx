import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

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
import type {
  CollectionQueryOptions,
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"
import type { ProjectScope } from "@/data/crucible/data.queries"
import { ResourceInspector } from "@/features/resource-inspector/resource-inspector"

export const Route = createFileRoute("/_app/data")({
  head: () => ({ meta: [{ title: "Data | Crucible Hub" }] }),
  validateSearch: dataSearchSchema.merge(resourcePreviewSearchSchema),
  loaderDeps: ({ search }) => ({
    affiliation: search.affiliation,
    createdFrom: search.createdFrom,
    createdTo: search.createdTo,
    datasetCursor: search.datasetCursor,
    direction: search.direction,
    instrumentMfid: search.instrumentMfid,
    kind: search.kind,
    projectMfid: search.projectMfid,
    projectScope: search.projectScope,
    sampleCursor: search.sampleCursor,
    sort: search.sort,
    visibility: search.visibility,
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const resolution = resolveDataFilters(deps)
    if (!resolution.valid) return
    const filters = collectionQueryFilters(resolution.filters)

    const missing: Promise<void>[] = []
    if (resolution.filters.kind !== "datasets") {
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
    if (resolution.filters.kind !== "samples") {
      const options = datasetsQueryOptions(source.scope, {
        cursor: deps.datasetCursor,
        ...filters,
        instrumentMfid: resolution.filters.instrumentMfid,
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
      <div className="flex min-w-0 flex-col gap-6">
        <DataTypeFilters kind={dataKind(search.kind)} />
        <DataFilters errors={resolution.errors} values={search} />
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
  const sampleResult = useQuery({
    ...samplesQueryOptions(scope, {
      cursor: search.sampleCursor,
      ...collectionFilters,
      limit: dataPageLimit,
    }),
    enabled: showSamples,
  })
  const datasetResult = useQuery({
    ...datasetsQueryOptions(scope, {
      cursor: search.datasetCursor,
      ...collectionFilters,
      instrumentMfid: filters.instrumentMfid,
      limit: dataPageLimit,
    }),
    enabled: showDatasets,
  })

  const samplePage = sampleResult.data
  const datasetPage = datasetResult.data
  const samplePending = showSamples && sampleResult.isPending
  const datasetPending = showDatasets && datasetResult.isPending
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
    filters.instrumentMfid ||
    filters.projectMfid ||
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
    <div className="flex min-w-0 flex-col gap-6">
      <CollectionUpdateStatus
        label="data"
        updating={hasReadableData && updating}
      />
      <DataTypeFilters
        datasetLabel={collectionLabel("Datasets", datasetPage)}
        kind={kind}
        sampleLabel={collectionLabel("Samples", samplePage)}
      />
      <DataFilters errors={[]} values={search} />

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
                          active={filters.sort === "name"}
                          direction={filters.direction ?? "desc"}
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
                          active={filters.sort === "updated"}
                          direction={filters.direction ?? "desc"}
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
                              dataset.modification_time ?? dataset.creation_time
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
  (
    | { projectMfid?: undefined; projectScope?: undefined }
    | { projectMfid: string; projectScope: ProjectScope }
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
  return filters.projectMfid
    ? {
        ...collectionFilters,
        ...collectionQuery,
        projectMfid: filters.projectMfid,
        projectScope: filters.projectScope,
      }
    : { ...collectionFilters, ...collectionQuery }
}
