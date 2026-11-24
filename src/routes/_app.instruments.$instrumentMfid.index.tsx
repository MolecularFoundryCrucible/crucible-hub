import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import { instrumentDatasetScope } from "@/data/crucible/instrument-dataset-scope"
import { createFileRoute } from "@tanstack/react-router"
import {
  datasetFiltersForGroup,
  instrumentDatasetBrowseOptions,
  resolveCollectionBrowse,
} from "@/data/crucible/collection-browse"
import { normalizeCollectionQueryOptions } from "@/data/crucible/collection-query"
import {
  dataPageLimit,
  datasetsCursorQueryOptions,
} from "@/data/crucible/data.queries"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import {
  InstrumentDatasetsPending,
  InstrumentDatasetsPage,
} from "@/features/instruments/instrument-datasets-page"
import {
  datasetScopeFilters,
  instrumentDatasetSearchSchema,
} from "@/features/instruments/instrument-datasets-search"

export const Route = createFileRoute("/_app/instruments/$instrumentMfid/")({
  validateSearch: instrumentDatasetSearchSchema,
  loaderDeps: ({ search }) => ({
    access: search.access,
    cursor: search.cursor,
    createdFrom: search.createdFrom,
    createdTo: search.createdTo,
    direction: search.direction,
    groupBy: search.groupBy,
    groupValue: search.groupValue,
    groupValueIsNull: search.groupValueIsNull,
    groupValueSet: search.groupValueSet,
    publicData: search.publicData,
    sort: search.sort,
    view: search.view,
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const instrument = (await parentMatchPromise).loaderData
    if (!instrument?.isInstrument || !instrument.instrumentMfid) return

    const browse = resolveCollectionBrowse(
      deps,
      instrumentDatasetBrowseOptions,
      instrument.dataGroupBy?.datasets
    )
    if (browse.view === "grouped" && browse.selection.kind === "all") return
    const baseFilters = {
      createdFrom: deps.createdFrom,
      createdTo: deps.createdTo,
      instrumentMfid: instrument.instrumentMfid,
      ...normalizeCollectionQueryOptions(
        {
          direction: deps.direction,
          sort: deps.sort,
        },
        instrument.defaultSort?.data
      ),
      ...datasetScopeFilters(
        instrumentDatasetScope({
          access: deps.access,
          elevated: privilegeModeFromScope(instrument.scope) === "elevated",
          includePublicByDefault: instrument.includePublicByDefault,
          publicData: deps.publicData,
          role: instrument.role,
        })
      ),
    }
    const filters =
      browse.view === "grouped"
        ? datasetFiltersForGroup(baseFilters, browse.field, browse.selection)
        : baseFilters
    const options = datasetsCursorQueryOptions(instrument.scope, {
      cursor: deps.cursor,
      ...filters,
      limit: dataPageLimit,
    })
    const request = prefetchInfiniteQueryWithReadableCache(
      context.queryClient,
      options
    )
    if (cause !== "stay") await request
  },
  pendingComponent: InstrumentDatasetsPending,
  component: InstrumentDatasetsPage,
  remountDeps: ({ params }) => ({ instrumentMfid: params.instrumentMfid }),
})
