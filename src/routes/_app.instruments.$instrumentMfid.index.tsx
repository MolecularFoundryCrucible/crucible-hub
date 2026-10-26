import { Checkbox } from "@/components/ui/checkbox"
import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import {
  publicDataFilterState,
  publicDataSearchSchema,
  publicDataSearchValue,
  resolveCollectionAffiliation,
} from "@/data/crucible/public-data"
import type { PublicDataChoice } from "@/data/crucible/public-data"
import { useIncludePublicByDefault } from "@/features/preferences/public-data"
import { useMemo, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, getRouteApi } from "@tanstack/react-router"
import { z } from "zod"

import {
  CollectionGroupControl,
  CollectionSection,
  CollectionToolbar,
  DatasetCollectionBrowser,
} from "@/components/crucible/collection-browser"
import {
  collectionActiveFilter,
  collectionActiveFilters,
  CollectionFilterPanel,
  FilterForm,
  FilterSection,
} from "@/components/crucible/collection-filter-panel"
import {
  CollectionLoadError,
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { CollectionPageNavigation } from "@/components/crucible/collection-page-navigation"
import {
  datasetCollectionName,
  useCursorResourceCollection,
} from "@/components/crucible/cursor-resource-collection"
import { InstrumentDatasetCollection } from "@/components/crucible/instrument-dataset-collection"
import {
  ResourcePreviewContext,
  resourcePreviewSearchSchema,
  useResourcePreviewNavigation,
} from "@/components/crucible/resource-preview-navigation"
import { ResourceInspector } from "@/features/resource-inspector/resource-inspector"
import {
  resourceSiblingSequenceLabel,
  useRegisterResourceSiblings,
} from "@/components/crucible/resource-sibling-navigation"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { buttonVariants } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  collectionBrowseSearchFields,
  collectionBrowseSearchState,
  collectionGroupOrderSearchState,
  datasetFiltersForGroup,
  instrumentDatasetBrowseOptions,
  resolveCollectionBrowse,
} from "@/data/crucible/collection-browse"
import type { CollectionGroupOrder } from "@/data/crucible/collection-browse"
import type { DatasetFacetField, FacetSelection } from "@/data/crucible/facets"
import { collectionFilterFields } from "@/data/crucible/collection-filters"
import {
  collectionOrderingSearchState,
  defaultCollectionOrdering,
  normalizeCollectionQueryOptions,
  resourceSortSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import type {
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"
import {
  dataPageLimit,
  datasetsCursorQueryOptions,
  datasetsQueryOptions,
} from "@/data/crucible/data.queries"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import {
  useDataGroupBy,
  useDefaultSort,
} from "@/features/preferences/data-group-by"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { searchDebounceMs } from "@/lib/search"
import {
  DateRangeFilter,
  dateRangeLabel,
} from "@/components/crucible/date-range-filter"

const instrumentDatasetSearchSchema = resourcePreviewSearchSchema.extend({
  ...collectionBrowseSearchFields,
  createdFrom: collectionFilterFields.createdFrom.catch(undefined),
  createdTo: collectionFilterFields.createdTo.catch(undefined),
  cursor: z.string().min(1).max(2048).optional().catch(undefined),
  direction: sortDirectionSchema.optional().catch(undefined),
  publicData: publicDataSearchSchema.optional().catch(undefined),
  sort: resourceSortSchema.optional().catch(undefined),
})

const instrumentRoute = getRouteApi("/_app/instruments/$instrumentMfid")

export const Route = createFileRoute("/_app/instruments/$instrumentMfid/")({
  validateSearch: instrumentDatasetSearchSchema,
  loaderDeps: ({ search }) => ({
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
      affiliation: resolveCollectionAffiliation({
        elevated: privilegeModeFromScope(instrument.scope) === "elevated",
        includePublicByDefault: instrument.includePublicByDefault,
        publicData: deps.publicData,
      }),
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

function InstrumentDatasetsPending() {
  const { instrumentMfid: routeInstrumentMfid } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const browse = resolveCollectionBrowse(search, instrumentDatasetBrowseOptions)

  function updateBrowse(values: Record<string, unknown>) {
    void navigate({
      params: { instrumentMfid: routeInstrumentMfid },
      search: (previous) => ({
        ...previous,
        cursor: undefined,
        ...values,
      }),
      to: "/instruments/$instrumentMfid",
    })
  }

  return (
    <CollectionSection>
      <CollectionToolbar
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <InstrumentDatasetFilters
              onApply={(values) =>
                updateBrowse({
                  createdFrom: values.createdFrom,
                  createdTo: values.createdTo,
                  publicData: values.publicData,
                  ...collectionOrderingSearchState(
                    values.sort,
                    values.direction
                  ),
                })
              }
              values={{
                createdFrom: search.createdFrom,
                createdTo: search.createdTo,
                direction: search.direction,
                publicData: search.publicData,
                sort: search.sort,
              }}
            />
            <CollectionGroupControl
              field={browse.field}
              id="instrument-dataset-group-field"
              onChange={(field) =>
                updateBrowse({
                  ...collectionBrowseSearchState({ kind: "all" }),
                  groupBy: field,
                  view: field ? "grouped" : "list",
                })
              }
              options={instrumentDatasetBrowseOptions}
              view={browse.view}
            />
          </div>
        }
        primary={<h2 className="text-title-section">Datasets</h2>}
      />
      <CollectionTablePending
        label="datasets"
        presentation="resources"
        subtypeLabel="Measurement"
      />
    </CollectionSection>
  )
}

function InstrumentDatasetsPage() {
  const { instrumentMfid: routeInstrumentMfid } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { cursor } = search
  const instrument = instrumentRoute.useLoaderData()
  const scope = useWorkspaceScope()
  const instrumentMfid = instrument?.instrumentMfid ?? ""
  const navigation = useResourcePreviewNavigation({
    instrumentMfid: instrumentMfid || routeInstrumentMfid,
    kind: "instrument-data",
    preview: search.preview,
  })
  const dataGroupBy = useDataGroupBy(
    instrument?.isInstrument ? instrument.dataGroupBy : undefined
  )
  const defaultSort = useDefaultSort(
    instrument?.isInstrument ? instrument.defaultSort : undefined
  )
  const includePublicByDefault = useIncludePublicByDefault(
    instrument?.isInstrument ? instrument.includePublicByDefault : undefined
  )
  const defaultOrdering = defaultSort?.data ?? defaultCollectionOrdering
  const browse = resolveCollectionBrowse(
    search,
    instrumentDatasetBrowseOptions,
    dataGroupBy?.datasets
  )
  const baseFilters = {
    createdFrom: search.createdFrom,
    createdTo: search.createdTo,
    instrumentMfid,
    ...normalizeCollectionQueryOptions(
      {
        direction: search.direction,
        sort: search.sort,
      },
      defaultOrdering
    ),
    affiliation: resolveCollectionAffiliation({
      elevated: privilegeModeFromScope(scope) === "elevated",
      includePublicByDefault,
      publicData: search.publicData,
    }),
  }
  const collectionFilters =
    browse.view === "grouped"
      ? datasetFiltersForGroup(baseFilters, browse.field, browse.selection)
      : baseFilters
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
    kind: "dataset",
    label: resourceSiblingSequenceLabel({
      filters: collectionFilters,
      kind: "dataset",
      scope: "instrument",
    }),
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
    <CollectionTablePending
      label="datasets"
      presentation="resources"
      subtypeLabel="Measurement"
    />
  ) : result.isError && !result.data ? (
    <>
      <CollectionLoadError
        label="Datasets"
        retry={() => void result.refetch()}
      />
      <CollectionPageNavigation
        label="Instrument dataset pages"
        previous={
          cursor ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ instrumentMfid: routeInstrumentMfid }}
              search={(previous) => ({ ...previous, cursor: undefined })}
              to="/instruments/$instrumentMfid"
            >
              First datasets
            </Link>
          ) : undefined
        }
      />
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
        direction={collectionFilters.direction}
        hasNextPage={Boolean(result.hasNextPage)}
        instrumentMfid={routeInstrumentMfid}
        isPaginationDisabled={result.isFetching && !result.isFetchingNextPage}
        isLoadingMore={result.isFetchingNextPage}
        items={items}
        loadMoreError={result.isFetchNextPageError}
        onLoadMore={() => void result.fetchNextPage()}
        onSort={changeSort}
        sort={collectionFilters.sort}
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
      to: "/instruments/$instrumentMfid",
    })
  }

  function selectGroup(selection: FacetSelection) {
    updateBrowse(collectionBrowseSearchState(selection))
  }

  function changeGroup(field: DatasetFacetField | undefined) {
    updateBrowse({
      ...collectionBrowseSearchState({ kind: "all" }),
      groupBy: field,
      view: field ? "grouped" : "list",
    })
  }

  function changeGroupOrder(
    order: CollectionGroupOrder,
    direction: SortDirection
  ) {
    void navigate({
      params: { instrumentMfid: routeInstrumentMfid },
      search: (previous) => ({
        ...previous,
        ...collectionGroupOrderSearchState(order, direction),
      }),
      to: "/instruments/$instrumentMfid",
    })
  }

  function changeSort(sort: ResourceSort, direction: SortDirection) {
    updateBrowse(
      collectionOrderingSearchState(sort, direction, defaultOrdering)
    )
  }

  return (
    <ResourcePreviewContext.Provider value={navigation}>
      <CollectionSection>
        <CollectionToolbar
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <InstrumentDatasetFilters
                onApply={(values) =>
                  updateBrowse({
                    createdFrom: values.createdFrom,
                    createdTo: values.createdTo,
                    publicData: values.publicData,
                    ...collectionOrderingSearchState(
                      values.sort,
                      values.direction,
                      defaultOrdering
                    ),
                  })
                }
                values={{
                  createdFrom: search.createdFrom,
                  createdTo: search.createdTo,
                  direction: search.direction,
                  publicData: search.publicData,
                  sort: search.sort,
                }}
              />
              <CollectionGroupControl
                field={browse.field}
                id="instrument-dataset-group-field"
                onChange={changeGroup}
                options={instrumentDatasetBrowseOptions}
                view={browse.view}
              />
            </div>
          }
          primary={<h2 className="text-title-section">Datasets</h2>}
        />
        {browse.view === "grouped" ? (
          <DatasetCollectionBrowser
            direction={browse.direction}
            field={browse.field}
            filters={baseFilters}
            onOrderChange={changeGroupOrder}
            order={browse.order}
            onSelect={selectGroup}
            selection={browse.selection}
          >
            {content}
          </DatasetCollectionBrowser>
        ) : (
          content
        )}
      </CollectionSection>
      <ResourceInspector navigation={navigation} />
    </ResourcePreviewContext.Provider>
  )
}

type InstrumentDatasetFilterValues = {
  createdFrom?: string
  createdTo?: string
  direction?: SortDirection
  publicData?: PublicDataChoice
  sort?: ResourceSort
}

function InstrumentDatasetFilters({
  onApply,
  values,
}: {
  onApply: (values: InstrumentDatasetFilterValues) => void
  values: InstrumentDatasetFilterValues
}) {
  const { instrumentMfid } = Route.useParams()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(values)
  const [rangeError, setRangeError] = useState<string>()
  const scope = useWorkspaceScope()
  const includePublicByDefault = useIncludePublicByDefault()
  const elevated = privilegeModeFromScope(scope) === "elevated"
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
  const rangeValid =
    !draft.createdFrom ||
    !draft.createdTo ||
    draft.createdFrom <= draft.createdTo
  const countKey = useDebouncedValue(
    JSON.stringify({
      affiliation: resolveCollectionAffiliation({
        elevated,
        includePublicByDefault,
        publicData: draft.publicData,
      }),
      createdFrom: draft.createdFrom,
      createdTo: draft.createdTo,
    }),
    searchDebounceMs
  )
  const count = useQuery({
    ...datasetsQueryOptions(scope, {
      ...(JSON.parse(countKey) as Pick<
        Parameters<typeof datasetsQueryOptions>[1],
        "affiliation" | "createdFrom" | "createdTo"
      >),
      includeTotal: true,
      instrumentMfid,
      limit: 1,
    }),
    enabled: open && rangeValid,
  })

  const boundsFilters = {
    affiliation: (
      JSON.parse(countKey) as Pick<
        Parameters<typeof datasetsQueryOptions>[1],
        "affiliation"
      >
    ).affiliation,
    includeTotal: false,
    instrumentMfid,
    limit: 1,
  }
  const firstDataset = useQuery({
    ...datasetsQueryOptions(scope, {
      ...boundsFilters,
      direction: "asc",
      sort: "created",
    }),
    enabled: open,
  })
  const lastDataset = useQuery({
    ...datasetsQueryOptions(scope, {
      ...boundsFilters,
      direction: "desc",
      sort: "created",
    }),
    enabled: open,
  })

  const active = collectionActiveFilters(
    collectionActiveFilter(
      "public",
      publicState.included ? "Public" : undefined
    ),
    collectionActiveFilter(
      "created",
      dateRangeLabel("Created", {
        from: values.createdFrom,
        to: values.createdTo,
      })
    )
  )
  const defaults: InstrumentDatasetFilterValues = {
    direction: values.direction,
    sort: values.sort,
  }

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!rangeValid) {
      setRangeError("The end date must not be before the start date.")
      return
    }
    setRangeError(undefined)
    setOpen(false)
    onApply(draft)
  }

  function reset() {
    setDraft(defaults)
    setRangeError(undefined)
  }

  function clear() {
    reset()
    onApply({
      createdFrom: undefined,
      createdTo: undefined,
      direction: values.direction,
      publicData: undefined,
      sort: values.sort,
    })
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) setDraft(values)
    setRangeError(undefined)
  }

  function removeFilter(id: string) {
    if (id === "public") {
      onApply({
        ...values,
        publicData: publicDataSearchValue(false, includePublicByDefault),
      })
    } else if (id === "created") {
      onApply({ ...values, createdFrom: undefined, createdTo: undefined })
    }
  }

  const formId = "instrument-dataset-filters"

  return (
    <CollectionFilterPanel
      activeFilters={active}
      formId={formId}
      onClearFilters={clear}
      onOpenChange={changeOpen}
      onRemoveFilter={removeFilter}
      onReset={reset}
      open={open}
      resetDisabled={JSON.stringify(draft) === JSON.stringify(defaults)}
      resultCount={rangeValid ? (count.data?.total ?? undefined) : undefined}
      resultNoun={["dataset", "datasets"]}
      title="Dataset filters"
    >
      <FilterForm id={formId} onSubmit={apply}>
        {draftPublicState.available ? (
          <FilterSection title="Scope">
            <Field orientation="horizontal">
              <Checkbox
                checked={draftPublicState.included}
                id="instrument-dataset-public"
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
              <FieldLabel htmlFor="instrument-dataset-public">
                Include public data
              </FieldLabel>
            </Field>
          </FilterSection>
        ) : null}
        <FilterSection title="Created">
          <DateRangeFilter
            bounds={{
              earliest: firstDataset.data?.items[0]?.creation_time,
              latest: lastDataset.data?.items[0]?.creation_time,
            }}
            boundsPending={firstDataset.isPending || lastDataset.isPending}
            errors={{ to: rangeError }}
            idPrefix="instrument-dataset-created"
            onChange={({ from, to }) => {
              setRangeError(undefined)
              setDraft((current) => ({
                ...current,
                createdFrom: from,
                createdTo: to,
              }))
            }}
            value={{ from: draft.createdFrom, to: draft.createdTo }}
          />
        </FilterSection>
      </FilterForm>
    </CollectionFilterPanel>
  )
}
