import { useMemo } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Link, createFileRoute, getRouteApi } from "@tanstack/react-router"
import { z } from "zod"

import {
  CollectionGroupControl,
  CollectionToolbar,
  DatasetCollectionBrowser,
} from "@/components/crucible/collection-browser"
import {
  CollectionLoadError,
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import {
  datasetCollectionName,
  useCursorResourceCollection,
} from "@/components/crucible/cursor-resource-collection"
import { InstrumentDatasetCollection } from "@/components/crucible/instrument-dataset-collection"
import { useRegisterResourceSiblings } from "@/components/crucible/resource-sibling-navigation"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { buttonVariants } from "@/components/ui/button"
import {
  collectionBrowseSearchFields,
  collectionBrowseSearchState,
  datasetFiltersForGroup,
  instrumentDatasetBrowseOptions,
  resolveCollectionBrowse,
} from "@/data/crucible/collection-browse"
import type { DatasetFacetField, FacetSelection } from "@/data/crucible/facets"
import {
  dataPageLimit,
  datasetsCursorQueryOptions,
} from "@/data/crucible/data.queries"

const instrumentDatasetSearchSchema = z.object({
  ...collectionBrowseSearchFields,
  cursor: z.string().min(1).max(2048).optional().catch(undefined),
})

const instrumentRoute = getRouteApi("/_app/instruments/$instrumentMfid")

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/datasets"
)({
  validateSearch: instrumentDatasetSearchSchema,
  loaderDeps: ({ search }) => ({
    cursor: search.cursor,
    groupBy: search.groupBy,
    groupValue: search.groupValue,
    groupValueIsNull: search.groupValueIsNull,
    groupValueSet: search.groupValueSet,
    view: search.view,
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const instrument = (await parentMatchPromise).loaderData
    if (!instrument?.isInstrument || !instrument.instrumentMfid) return

    const browse = resolveCollectionBrowse(deps, instrumentDatasetBrowseOptions)
    if (browse.view === "grouped" && browse.selection.kind === "all") return
    const filters =
      browse.view === "grouped"
        ? datasetFiltersForGroup(
            { instrumentMfid: instrument.instrumentMfid },
            browse.field,
            browse.selection
          )
        : { instrumentMfid: instrument.instrumentMfid }
    const options = datasetsCursorQueryOptions(instrument.scope, {
      cursor: deps.cursor,
      ...filters,
      limit: dataPageLimit,
    })
    const hasData =
      context.queryClient.getQueryData(options.queryKey) !== undefined
    const request = context.queryClient.prefetchInfiniteQuery(options)
    if (cause === "stay" || hasData) {
      void request
      return
    }

    await request
  },
  pendingComponent: InstrumentDatasetsPending,
  component: InstrumentDatasetsPage,
})

function InstrumentDatasetsPending() {
  return <CollectionTablePending label="datasets" />
}

function InstrumentDatasetsPage() {
  const { instrumentMfid: routeInstrumentMfid } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { cursor } = search
  const instrument = instrumentRoute.useLoaderData()
  const scope = useWorkspaceScope()
  const instrumentMfid = instrument?.instrumentMfid ?? ""
  const browse = resolveCollectionBrowse(search, instrumentDatasetBrowseOptions)
  const collectionFilters =
    browse.view === "grouped"
      ? datasetFiltersForGroup(
          { instrumentMfid },
          browse.field,
          browse.selection
        )
      : { instrumentMfid }
  const result = useInfiniteQuery({
    ...datasetsCursorQueryOptions(scope, {
      cursor,
      ...collectionFilters,
      limit: dataPageLimit,
    }),
    enabled:
      Boolean(instrumentMfid) &&
      (browse.view !== "grouped" || browse.selection.kind !== "all"),
  })
  const collection = useCursorResourceCollection({
    getName: datasetCollectionName,
    initialCursor: cursor,
    kind: "dataset",
    query: result,
  })
  const siblingCollections = useMemo(
    () => (result.data ? [collection.siblingCollection] : []),
    [collection.siblingCollection, result.data]
  )
  useRegisterResourceSiblings(siblingCollections)
  const items = collection.items
  const total = collection.total

  if (!instrumentMfid) return null

  const content = result.isPending ? (
    <InstrumentDatasetsPending />
  ) : result.isError && !result.data ? (
    <>
      <CollectionLoadError
        label="Datasets"
        retry={() => void result.refetch()}
      />
      {cursor ? (
        <nav className="flex justify-end" aria-label="Instrument dataset pages">
          <Link
            className={buttonVariants({ variant: "outline" })}
            from="/instruments/$instrumentMfid/datasets"
            params={{ instrumentMfid: routeInstrumentMfid }}
            search={(previous) => ({ ...previous, cursor: undefined })}
            to="/instruments/$instrumentMfid/datasets"
          >
            First datasets
          </Link>
        </nav>
      ) : null}
    </>
  ) : (
    <>
      <CollectionUpdateStatus
        label="datasets"
        updating={result.isFetching && !result.isFetchingNextPage}
      />
      {result.isError && !result.isFetchNextPageError ? (
        <CollectionUpdateError
          label="Datasets"
          preserved
          retry={() => void result.refetch()}
        />
      ) : null}
      <InstrumentDatasetCollection
        cursor={cursor}
        hasNextPage={Boolean(result.hasNextPage)}
        instrumentMfid={routeInstrumentMfid}
        isPaginationDisabled={result.isFetching && !result.isFetchingNextPage}
        isLoadingMore={result.isFetchingNextPage}
        items={items}
        loadMoreError={result.isFetchNextPageError}
        onLoadMore={() => void result.fetchNextPage()}
        total={total}
        updating={result.isFetching && !result.isFetchingNextPage}
      />
    </>
  )

  function updateBrowse(values: Record<string, unknown>) {
    void navigate({
      params: { instrumentMfid: routeInstrumentMfid },
      search: (previous) => ({
        ...previous,
        cursor: undefined,
        ...values,
      }),
      to: "/instruments/$instrumentMfid/datasets",
    })
  }

  function selectGroup(selection: FacetSelection) {
    updateBrowse(collectionBrowseSearchState(selection))
  }

  function changeGroup(field: DatasetFacetField | undefined) {
    updateBrowse({
      ...collectionBrowseSearchState({ kind: "all" }),
      groupBy: field,
      view: field ? "grouped" : undefined,
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CollectionToolbar
        actions={
          <CollectionGroupControl
            field={browse.field}
            id="instrument-dataset-group-field"
            onChange={changeGroup}
            options={instrumentDatasetBrowseOptions}
            view={browse.view}
          />
        }
        primary={<h2 className="text-title-section">Datasets</h2>}
      />
      {browse.view === "grouped" ? (
        <DatasetCollectionBrowser
          field={browse.field}
          filters={{ instrumentMfid }}
          onSelect={selectGroup}
          selection={browse.selection}
        >
          {content}
        </DatasetCollectionBrowser>
      ) : (
        content
      )}
    </div>
  )
}
