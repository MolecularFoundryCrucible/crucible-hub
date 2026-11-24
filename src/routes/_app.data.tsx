import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import { loadIncludePublicByDefault } from "@/hooks/public-data"
import { createFileRoute } from "@tanstack/react-router"
import { resourcePreviewSearchSchema } from "@/data/crucible/resource-preview-search"
import {
  collectionQueryFilters,
  dataSearchSchema,
  resolveDataFilters,
} from "@/features/data/data-filter-state"
import {
  dataPageLimit,
  datasetsCursorQueryOptions,
  samplesCursorQueryOptions,
} from "@/data/crucible/data.queries"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import {
  datasetFiltersForGroup,
  globalDatasetBrowseOptions,
  globalSampleBrowseOptions,
  resolveCollectionBrowse,
  sampleFiltersForGroup,
} from "@/data/crucible/collection-browse"
import {
  loadDataGroupBy,
  loadDefaultSort,
} from "@/features/preferences/data-group-by"
import { DataRoutePending, DataPage } from "@/features/data/data-page"

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
    publicData: search.publicData,
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
    const [groupBy, defaultSort, includePublicByDefault] = await Promise.all([
      loadDataGroupBy(
        context.queryClient,
        source.scope,
        source.accountPreferencesEnabled
      ),
      loadDefaultSort(
        context.queryClient,
        source.scope,
        source.accountPreferencesEnabled
      ),
      source.accountPreferencesEnabled
        ? loadIncludePublicByDefault(context.queryClient, source.scope)
        : false,
    ])
    const resolution = resolveDataFilters(deps, defaultSort?.data)
    if (!resolution.valid) {
      return { dataGroupBy: groupBy, defaultSort, includePublicByDefault }
    }
    const baseFilters = collectionQueryFilters(resolution.filters, {
      elevated: privilegeModeFromScope(source.scope) === "elevated",
      includePublicByDefault,
    })
    const sampleBrowse =
      resolution.filters.kind === "samples"
        ? resolveCollectionBrowse(
            deps,
            globalSampleBrowseOptions,
            groupBy?.samples
          )
        : undefined
    const datasetBrowse =
      resolution.filters.kind === "datasets"
        ? resolveCollectionBrowse(
            deps,
            globalDatasetBrowseOptions,
            groupBy?.datasets
          )
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
    return { dataGroupBy: groupBy, defaultSort, includePublicByDefault }
  },
  pendingComponent: DataRoutePending,
  staleTime: Infinity,
  component: DataPage,
})
