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
import { ResourceCollectionNameCell } from "@/components/crucible/resource-collection-name-cell"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import {
  ResourcePreviewContext,
  resourcePreviewSearchSchema,
  useResourcePreviewNavigation,
} from "@/components/crucible/resource-preview-navigation"
import { RouteContentPending } from "@/components/crucible/route-content-pending"
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
import { formatDate } from "@/lib/format"
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
import type { ProjectScope } from "@/data/crucible/data.queries"
import { ResourceInspector } from "@/features/resource-inspector/resource-inspector"

export const Route = createFileRoute("/_app/data")({
  head: () => ({ meta: [{ title: "Data | Crucible Hub" }] }),
  validateSearch: dataSearchSchema.merge(resourcePreviewSearchSchema),
  loaderDeps: ({ search }) => ({
    createdFrom: search.createdFrom,
    createdTo: search.createdTo,
    datasetCursor: search.datasetCursor,
    instrumentMfid: search.instrumentMfid,
    kind: search.kind,
    projectMfid: search.projectMfid,
    projectScope: search.projectScope,
    sampleCursor: search.sampleCursor,
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
  pendingComponent: RouteContentPending,
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
        <PageHeader
          actions={<ResourceCreationActions />}
          eyebrow="Data"
          title="Samples and datasets"
        />
        <DataCollection />
      </PageLayout>
      <ResourceInspector navigation={navigation} />
    </ResourcePreviewContext.Provider>
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
    filters.visibility
  )
  const updating =
    (showSamples && sampleResult.isFetching) ||
    (showDatasets && datasetResult.isFetching)

  function retrySelected() {
    if (showSamples) void sampleResult.refetch()
    if (showDatasets) void datasetResult.refetch()
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <CollectionUpdateStatus label="data" updating={updating} />
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
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden xl:table-cell">
                        Type
                      </TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Updated</TableHead>
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
                          <TableCell
                            className="resource-collection-project"
                            data-label="Project"
                          >
                            <span
                              className="block truncate"
                              title={sample.project_id ?? undefined}
                            >
                              {sample.project_id ?? "Unassigned"}
                            </span>
                          </TableCell>
                          <TableCell
                            className="resource-collection-owner"
                            data-label="Owner"
                          >
                            <span
                              className="block truncate"
                              title={sample.owner?.username ?? undefined}
                            >
                              {sample.owner?.username ?? "Unknown owner"}
                            </span>
                          </TableCell>
                          <TableCell
                            className="resource-collection-date"
                            data-label="Updated"
                          >
                            {formatDate(
                              sample.modification_time ?? sample.creation_time
                            )}
                          </TableCell>
                          <TableCell className="resource-collection-action text-center">
                            <ResourceFullPageLink
                              kind="sample"
                              mfid={sample.unique_id}
                              name={sample.sample_name}
                              presentation="table"
                            />
                          </TableCell>
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
                          <TableCell
                            className="resource-collection-project"
                            data-label="Project"
                          >
                            {dataset.project ? (
                              <Link
                                className="block truncate text-label hover:underline"
                                params={{
                                  projectMfid: dataset.project.unique_id,
                                }}
                                title={
                                  dataset.project.title ??
                                  dataset.project.project_id
                                }
                                to="/projects/$projectMfid"
                              >
                                {dataset.project.title ??
                                  dataset.project.project_id}
                              </Link>
                            ) : (
                              <span
                                className="block truncate"
                                title={dataset.project_id ?? undefined}
                              >
                                {dataset.project_id ?? "Unassigned"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            className="resource-collection-owner"
                            data-label="Owner"
                          >
                            <span
                              className="block truncate"
                              title={dataset.owner?.username ?? undefined}
                            >
                              {dataset.owner?.username ?? "Unknown owner"}
                            </span>
                          </TableCell>
                          <TableCell
                            className="resource-collection-date"
                            data-label="Updated"
                          >
                            {formatDate(
                              dataset.modification_time ?? dataset.creation_time
                            )}
                          </TableCell>
                          <TableCell className="resource-collection-action text-center">
                            <ResourceFullPageLink
                              kind="dataset"
                              mfid={dataset.unique_id}
                              name={dataset.dataset_name ?? "Untitled dataset"}
                              presentation="table"
                            />
                          </TableCell>
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
  return filters.projectMfid
    ? {
        ...collectionFilters,
        projectMfid: filters.projectMfid,
        projectScope: filters.projectScope,
      }
    : collectionFilters
}
