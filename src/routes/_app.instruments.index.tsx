import { useEffect, useMemo, useState } from "react"
import {
  useInfiniteQuery,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { useEnteringClassName } from "@/hooks/use-entering-keys"
import { resourceDisplayName } from "@/lib/resource-name"

import { CollectionToolbar } from "@/components/crucible/collection-browser"
import {
  CollectionFilterPanel,
  collectionActiveFilter,
  collectionActiveFilters,
} from "@/components/crucible/collection-filter-panel"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import {
  CollectionLoadError,
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { PendingRegion } from "@/components/crucible/pending-region"
import { PersonLink } from "@/components/crucible/person-link"
import { RefreshButton } from "@/components/crucible/refresh-button"
import { ResourceChooser } from "@/components/crucible/resource-chooser"
import {
  ResourceCreatedCell,
  ResourceOpenCell,
  ResourceActivityCell,
} from "@/components/crucible/resource-collection-cells"
import { ResourceCreationLink } from "@/components/crucible/resource-creation-actions"
import { ResourceDirectoryNameCell } from "@/components/crucible/resource-directory-name-cell"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import {
  instrumentPageLimit,
  instrumentsCursorQueryOptions,
} from "@/data/crucible/instruments.queries"
import { personQueryOptions } from "@/data/crucible/people.queries"
import type {
  InstrumentAffiliation,
  SortDirection,
} from "@/data/crucible/collection-query"
import {
  collectionCursorSchema,
  instrumentAffiliationSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import { defaultOrderLabel, sortLabel } from "@/data/crucible/filter-draft"
import {
  instrumentStatusLabel,
  instrumentStatuses,
} from "@/data/crucible/instrument-status"
import type {
  WorkspaceInstrument,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"
import {
  cursorPageTotal,
  flattenCursorPages,
} from "@/data/crucible/cursor-pages"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import {
  loadDefaultSort,
  useDefaultSort,
} from "@/features/preferences/data-group-by"

const instrumentSortFieldSchema = z.enum([
  "name",
  "created",
  "updated",
  "activity",
])
export type InstrumentSortField = z.infer<typeof instrumentSortFieldSchema>

const instrumentStatusFilterSchema = z.enum([...instrumentStatuses, "all"])
type InstrumentStatusFilter = z.infer<typeof instrumentStatusFilterSchema>

const instrumentSearchSchema = z.object({
  affiliation: instrumentAffiliationSchema.optional().catch(undefined),
  cursor: collectionCursorSchema,
  direction: sortDirectionSchema.optional().catch(undefined),
  instrumentType: z.string().trim().min(1).max(255).optional().catch(undefined),
  location: z.string().trim().min(1).max(255).optional().catch(undefined),
  manufacturer: z.string().trim().min(1).max(255).optional().catch(undefined),
  ownerId: z.string().trim().min(1).max(255).optional().catch(undefined),
  sort: instrumentSortFieldSchema.optional().catch(undefined),
  status: instrumentStatusFilterSchema.optional().catch(undefined),
})

type InstrumentSearch = z.infer<typeof instrumentSearchSchema>

export const Route = createFileRoute("/_app/instruments/")({
  head: () => ({ meta: [{ title: "Instruments | Crucible Hub" }] }),
  validateSearch: instrumentSearchSchema,
  loaderDeps: ({ search }) => ({
    affiliation: search.affiliation,
    cursor: search.cursor,
    direction: search.direction,
    instrumentType: search.instrumentType,
    location: search.location,
    manufacturer: search.manufacturer,
    ownerId: search.ownerId,
    sort: search.sort,
    status: search.status ?? "active",
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const defaultSort = await loadDefaultSort(
      context.queryClient,
      source.scope,
      source.accountPreferencesEnabled
    )
    const preferredSort = defaultSort?.instruments
    const effectiveSort = deps.sort ?? preferredSort?.sort
    const effectiveDirection =
      deps.direction ?? (deps.sort ? undefined : preferredSort?.direction)

    const options = instrumentsCursorQueryOptions(source.scope, {
      affiliation: deps.affiliation,
      cursor: deps.cursor,
      direction: effectiveSort ? effectiveDirection : undefined,
      includeOwner: true,
      includeTotal: true,
      instrumentType: deps.instrumentType,
      limit: instrumentPageLimit,
      location: deps.location,
      manufacturer: deps.manufacturer,
      ownerId: deps.ownerId,
      sort: effectiveSort,
      status: deps.status === "all" ? undefined : deps.status,
    })
    const request = prefetchInfiniteQueryWithReadableCache(
      context.queryClient,
      options
    )
    if (cause !== "stay" && request) await request
    return { defaultSort }
  },
  pendingComponent: InstrumentsRoutePending,
  staleTime: Infinity,
  component: InstrumentsPage,
})

function InstrumentsPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const loaderData = Route.useLoaderData()
  const defaultSort = useDefaultSort(loaderData?.defaultSort)
  const preferredSort = defaultSort?.instruments
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const status = search.status ?? "active"
  const sort = search.sort ?? preferredSort?.sort
  const queryDirection =
    search.direction ?? (search.sort ? undefined : preferredSort?.direction)
  const direction = queryDirection ?? "asc"
  const instrumentResult = useInfiniteQuery(
    instrumentsCursorQueryOptions(scope, {
      affiliation: search.affiliation,
      cursor: search.cursor,
      direction: sort ? queryDirection : undefined,
      includeOwner: true,
      includeTotal: true,
      instrumentType: search.instrumentType,
      limit: instrumentPageLimit,
      location: search.location,
      manufacturer: search.manufacturer,
      ownerId: search.ownerId,
      sort,
      status: status === "all" ? undefined : status,
    })
  )
  const instruments = useMemo(
    () => flattenCursorPages(instrumentResult.data?.pages),
    [instrumentResult.data]
  )
  const total = cursorPageTotal(instrumentResult.data?.pages)
  const updating =
    instrumentResult.isFetching && !instrumentResult.isFetchingNextPage
  const hasSecondaryFilters = Boolean(
    search.ownerId ||
    search.instrumentType ||
    search.location ||
    search.manufacturer
  )

  function handleSortChange(
    nextField: InstrumentSortField,
    nextDirection: SortDirection
  ) {
    void navigate({
      replace: true,
      search: (previous) => ({
        ...previous,
        cursor: undefined,
        direction: nextDirection,
        sort: nextField,
      }),
      state: {},
      to: "/instruments",
    })
  }

  return (
    <PageLayout>
      <InstrumentsPageHeader
        canRegister={account.capabilities.can_register_instrument}
      />
      <CollectionToolbar
        actions={
          <>
            <InstrumentDirectoryFilters
              defaultOrdering={preferredSort}
              values={search}
            />
            <RefreshButton
              label="Refresh instruments"
              onClick={() => void instrumentResult.refetch()}
              refreshing={updating}
            />
          </>
        }
      />
      {instrumentResult.isPending ? (
        <CollectionTablePending
          label="instruments"
          presentation="instruments"
        />
      ) : instrumentResult.isError && !instrumentResult.data ? (
        <>
          <CollectionLoadError
            label="Instruments"
            retry={() => void instrumentResult.refetch()}
          />
        </>
      ) : (
        <>
          {instrumentResult.isError &&
          !instrumentResult.isFetchNextPageError ? (
            <CollectionUpdateError
              label="Instruments"
              preserved
              retry={() => void instrumentResult.refetch()}
            />
          ) : null}
          <InstrumentCollection
            affiliation={search.affiliation}
            direction={direction}
            hasNextPage={Boolean(instrumentResult.hasNextPage)}
            hasSecondaryFilters={hasSecondaryFilters}
            instruments={instruments}
            isLoadingMore={instrumentResult.isFetchingNextPage}
            loadMoreError={instrumentResult.isFetchNextPageError}
            onLoadMore={() => void instrumentResult.fetchNextPage()}
            onSortChange={handleSortChange}
            sort={sort}
            status={status}
            total={total}
            updating={updating}
          />
        </>
      )}
    </PageLayout>
  )
}

function InstrumentsRoutePending() {
  const scope = useWorkspaceScope()
  const { data: account } = useQuery(accountQueryOptions(scope))
  const search = Route.useSearch()
  return (
    <PageLayout>
      <InstrumentsPageHeader
        canRegister={account?.capabilities.can_register_instrument === true}
      />
      <CollectionToolbar
        actions={
          <>
            <InstrumentDirectoryFilters values={search} />
            <RefreshButton
              label="Refresh instruments"
              onClick={() => undefined}
              refreshing={false}
            />
          </>
        }
      />
      <CollectionTablePending label="instruments" presentation="instruments" />
    </PageLayout>
  )
}

type InstrumentFilterValues = Omit<InstrumentSearch, "cursor">

function InstrumentDirectoryFilters({
  defaultOrdering,
  values,
}: {
  defaultOrdering?: { direction: SortDirection; sort: InstrumentSortField }
  values: InstrumentFilterValues
}) {
  const navigate = Route.useNavigate()
  const scope = useWorkspaceScope()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<InstrumentFilterValues>(values)
  const [ownerName, setOwnerName] = useState<string>()
  const valuesKey = JSON.stringify({
    affiliation: values.affiliation,
    direction: values.direction,
    instrumentType: values.instrumentType,
    location: values.location,
    manufacturer: values.manufacturer,
    ownerId: values.ownerId,
    sort: values.sort,
    status: values.status,
  })

  useEffect(() => {
    setDraft(JSON.parse(valuesKey) as InstrumentFilterValues)
    setOwnerName(undefined)
  }, [valuesKey])

  const ownerResult = useQuery({
    ...personQueryOptions(scope, values.ownerId ?? ""),
    enabled: Boolean(values.ownerId),
  })
  const resolvedOwnerName = ownerResult.data
    ? `${ownerResult.data.first_name} ${ownerResult.data.last_name}`.trim()
    : undefined

  const effectiveStatus = values.status ?? "active"
  const effectiveDirection =
    values.direction ?? (values.sort === "name" ? "asc" : "desc")

  const active = collectionActiveFilters(
    collectionActiveFilter(
      "status",
      effectiveStatus !== "active"
        ? `Status: ${
            effectiveStatus === "all"
              ? "All statuses"
              : instrumentStatusLabel(effectiveStatus)
          }`
        : undefined
    ),
    collectionActiveFilter(
      "affiliation",
      values.affiliation === "owner"
        ? "Management: Owned by me"
        : values.affiliation === "managed"
          ? "Management: Managed by me"
          : undefined
    ),
    collectionActiveFilter(
      "owner",
      values.ownerId
        ? `Manager: ${resolvedOwnerName ?? values.ownerId}`
        : undefined
    ),
    collectionActiveFilter(
      "instrument-type",
      values.instrumentType ? `Type: ${values.instrumentType}` : undefined
    ),
    collectionActiveFilter(
      "location",
      values.location ? `Location: ${values.location}` : undefined
    ),
    collectionActiveFilter(
      "manufacturer",
      values.manufacturer ? `Manufacturer: ${values.manufacturer}` : undefined
    ),
    collectionActiveFilter(
      "order",
      values.sort
        ? `Order: ${sortLabel(values.sort)} (${effectiveDirection === "asc" ? "ascending" : "descending"})`
        : undefined
    )
  )

  function updateSearch(next: InstrumentFilterValues) {
    void navigate({
      search: () => ({
        affiliation: next.affiliation,
        cursor: undefined,
        direction: next.sort ? next.direction : undefined,
        instrumentType: next.instrumentType?.trim() || undefined,
        location: next.location?.trim() || undefined,
        manufacturer: next.manufacturer?.trim() || undefined,
        ownerId: next.ownerId?.trim() || undefined,
        sort: next.sort,
        status:
          !next.status || next.status === "active" ? undefined : next.status,
      }),
      state: {},
      to: "/instruments",
    })
  }

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOpen(false)
    updateSearch(draft)
  }

  function clear() {
    const empty: InstrumentFilterValues = {}
    setDraft(empty)
    setOwnerName(undefined)
    setOpen(false)
    updateSearch(empty)
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setDraft(values)
      setOwnerName(undefined)
    }
  }

  function removeFilter(id: string) {
    if (id === "status") {
      updateSearch({ ...values, status: undefined })
    } else if (id === "affiliation") {
      updateSearch({ ...values, affiliation: undefined })
    } else if (id === "owner") {
      updateSearch({ ...values, ownerId: undefined })
    } else if (id === "instrument-type") {
      updateSearch({ ...values, instrumentType: undefined })
    } else if (id === "location") {
      updateSearch({ ...values, location: undefined })
    } else if (id === "manufacturer") {
      updateSearch({ ...values, manufacturer: undefined })
    } else if (id === "order") {
      updateSearch({ ...values, direction: undefined, sort: undefined })
    }
  }

  const draftStatus = draft.status ?? "active"
  const draftDirection =
    draft.direction ?? (draft.sort === "name" ? "asc" : "desc")
  const selectedOwner: WorkspaceSearchResult | undefined = draft.ownerId
    ? {
        context: null,
        kind: "person",
        name:
          ownerName ??
          (draft.ownerId === values.ownerId ? resolvedOwnerName : undefined) ??
          draft.ownerId,
        unique_id: draft.ownerId,
      }
    : undefined

  return (
    <CollectionFilterPanel
      activeFilters={active}
      footer={
        <>
          <Button onClick={clear} type="button" variant="outline">
            Clear filters
          </Button>
          <Button form="instrument-filters" type="submit">
            Apply filters
          </Button>
        </>
      }
      onClearFilters={clear}
      onOpenChange={changeOpen}
      onRemoveFilter={removeFilter}
      open={open}
      title="Instrument filters"
    >
      <form
        className="flex flex-col gap-4"
        id="instrument-filters"
        onSubmit={apply}
      >
        <FieldSet>
          <FieldLegend className="sr-only">Instrument filters</FieldLegend>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="instrument-filter-status">
                Lifecycle status
              </FieldLabel>
              <NativeSelect
                className="w-full"
                id="instrument-filter-status"
                onChange={(event) => {
                  const nextStatus = event.target
                    .value as InstrumentStatusFilter
                  setDraft((current) => ({
                    ...current,
                    status: nextStatus === "active" ? undefined : nextStatus,
                  }))
                }}
                value={draftStatus}
              >
                {instrumentStatuses.map((candidate) => (
                  <NativeSelectOption key={candidate} value={candidate}>
                    {instrumentStatusLabel(candidate)}
                  </NativeSelectOption>
                ))}
                <NativeSelectOption value="all">
                  All statuses
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="instrument-filter-affiliation">
                Management
              </FieldLabel>
              <NativeSelect
                className="w-full"
                id="instrument-filter-affiliation"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    affiliation:
                      event.target.value === "owner" ||
                      event.target.value === "managed"
                        ? event.target.value
                        : undefined,
                  }))
                }
                value={draft.affiliation ?? ""}
              >
                <NativeSelectOption value="">
                  All instruments
                </NativeSelectOption>
                <NativeSelectOption value="owner">
                  Owned by me
                </NativeSelectOption>
                <NativeSelectOption value="managed">
                  Managed by me
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="instrument-filter-owner">Manager</FieldLabel>
              <ResourceChooser
                emptyLabel="All managers"
                excludeServiceAccounts
                kind="person"
                onChange={(person) => {
                  setDraft((current) => ({
                    ...current,
                    ownerId: person?.unique_id,
                  }))
                  setOwnerName(person?.name)
                }}
                triggerId="instrument-filter-owner"
                value={selectedOwner}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="instrument-filter-type">
                Instrument type
              </FieldLabel>
              <Input
                id="instrument-filter-type"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    instrumentType: event.target.value || undefined,
                  }))
                }
                placeholder="All types"
                value={draft.instrumentType ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="instrument-filter-location">
                Location
              </FieldLabel>
              <Input
                id="instrument-filter-location"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    location: event.target.value || undefined,
                  }))
                }
                placeholder="All locations"
                value={draft.location ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="instrument-filter-manufacturer">
                Manufacturer
              </FieldLabel>
              <Input
                id="instrument-filter-manufacturer"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    manufacturer: event.target.value || undefined,
                  }))
                }
                placeholder="All manufacturers"
                value={draft.manufacturer ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="instrument-filter-sort">Order by</FieldLabel>
              <NativeSelect
                className="w-full"
                id="instrument-filter-sort"
                onChange={(event) => {
                  const nextSort = instrumentSortFieldSchema.safeParse(
                    event.target.value
                  ).data
                  setDraft((current) => ({
                    ...current,
                    direction: nextSort
                      ? (current.direction ??
                        (nextSort === "name" ? "asc" : "desc"))
                      : undefined,
                    sort: nextSort,
                  }))
                }}
                value={draft.sort ?? ""}
              >
                <NativeSelectOption value="">
                  {defaultOrderLabel(
                    defaultOrdering ?? { direction: "asc", sort: "name" }
                  )}
                </NativeSelectOption>
                <NativeSelectOption value="name">Name</NativeSelectOption>
                <NativeSelectOption value="created">Created</NativeSelectOption>
                <NativeSelectOption value="updated">Updated</NativeSelectOption>
                <NativeSelectOption value="activity">
                  Last activity
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            {draft.sort ? (
              <Field>
                <FieldLabel htmlFor="instrument-filter-direction">
                  Direction
                </FieldLabel>
                <NativeSelect
                  className="w-full"
                  id="instrument-filter-direction"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      direction: event.target.value === "asc" ? "asc" : "desc",
                    }))
                  }
                  value={draftDirection}
                >
                  <NativeSelectOption value="desc">
                    Descending
                  </NativeSelectOption>
                  <NativeSelectOption value="asc">Ascending</NativeSelectOption>
                </NativeSelect>
              </Field>
            ) : null}
          </FieldGroup>
        </FieldSet>
      </form>
    </CollectionFilterPanel>
  )
}

function InstrumentsPageHeader({ canRegister }: { canRegister: boolean }) {
  return (
    <PageHeader
      actions={
        canRegister ? (
          <ResourceCreationLink
            label="Register instrument"
            render={<Link to="/instruments/new" />}
          />
        ) : null
      }
      title="Instrument directory"
    />
  )
}

function InstrumentCollection({
  affiliation,
  direction = "asc",
  hasNextPage,
  hasSecondaryFilters,
  instruments,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  onSortChange,
  sort,
  status,
  total,
  updating,
}: {
  affiliation?: InstrumentAffiliation
  direction?: SortDirection
  hasNextPage: boolean
  hasSecondaryFilters: boolean
  instruments: readonly WorkspaceInstrument[]
  isLoadingMore: boolean
  loadMoreError: boolean
  onLoadMore: () => void
  onSortChange: (field: InstrumentSortField, direction: SortDirection) => void
  sort?: InstrumentSortField
  status: InstrumentStatusFilter
  total: number | null
  updating: boolean
}) {
  const enterClassName = useEnteringClassName(
    instruments.map((item) => item.unique_id)
  )
  return (
    <>
      <CollectionUpdateStatus label="instruments" updating={updating} />
      {instruments.length > 0 ? (
        <PendingRegion pending={updating} render={<Card />}>
          <CardContent className="px-0">
            <Table
              aria-label="Instrument directory"
              className="resource-directory-table resource-directory-instrument-table table-fixed"
            >
              <colgroup>
                <col className="resource-directory-name-column" />
                <col className="resource-directory-location-column w-column-secondary" />
                <col className="resource-directory-person-column" />
                <col className="resource-directory-date-column resource-directory-created-column" />
                <col className="resource-directory-date-column" />
                <col className="resource-directory-action-column" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    active={sort === "name"}
                    direction={direction}
                    field="name"
                    label="Instrument"
                    onChange={onSortChange}
                    preferredDirection="asc"
                  />
                  <TableHead className="resource-directory-location">
                    Location
                  </TableHead>
                  <TableHead className="resource-directory-person">
                    Manager
                  </TableHead>
                  <SortableTableHead
                    active={sort === "created"}
                    className="resource-directory-created"
                    direction={direction}
                    field="created"
                    kind="date"
                    label="Created"
                    onChange={onSortChange}
                    preferredDirection="desc"
                  />
                  <SortableTableHead
                    active={sort === "activity"}
                    direction={direction}
                    field="activity"
                    kind="date"
                    label="Last activity"
                    onChange={onSortChange}
                    preferredDirection="desc"
                  />
                  <TableHead kind="action">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instruments.map((instrument) => {
                  const instrumentId = instrument.instrument_id?.trim()
                  const name = resourceDisplayName(
                    "instrument",
                    instrument.instrument_name,
                    { identifier: instrumentId, mfid: instrument.unique_id }
                  )
                  return (
                    <TableRow
                      className={enterClassName(instrument.unique_id)}
                      key={instrument.unique_id}
                    >
                      <ResourceDirectoryNameCell
                        identifier={instrumentId}
                        kind="instrument"
                        mfid={instrument.unique_id}
                        name={name}
                      />
                      <TableCell
                        className="resource-directory-location"
                        data-label="Location"
                      >
                        {instrument.location || "-"}
                      </TableCell>
                      <TableCell
                        className="resource-directory-person"
                        data-label="Manager"
                      >
                        {instrument.owner ? (
                          <PersonLink
                            nameStyle="abbreviated"
                            person={instrument.owner}
                            presentation="collection"
                          />
                        ) : (
                          <span aria-label="Not available">-</span>
                        )}
                      </TableCell>
                      <ResourceCreatedCell
                        className="resource-directory-created"
                        value={instrument.creation_time}
                      />
                      <ResourceActivityCell
                        value={instrument.last_activity_at}
                      />
                      <ResourceOpenCell
                        kind="instrument"
                        mfid={instrument.unique_id}
                        name={name}
                      />
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </PendingRegion>
      ) : (
        <section aria-label="Instrument directory">
          <Empty className="min-h-state border">
            <EmptyHeader>
              <EmptyTitle>No instruments found</EmptyTitle>
              <EmptyDescription>
                {hasSecondaryFilters
                  ? "No instruments match the active filters."
                  : status === "all"
                    ? affiliation === "owner"
                      ? "You do not own any instruments."
                      : affiliation
                        ? "You do not manage any instruments."
                        : "No instruments are available to this account."
                    : affiliation === "owner"
                      ? `You do not own any ${instrumentStatusLabel(status).toLowerCase()} instruments.`
                      : affiliation
                        ? `You do not manage any ${instrumentStatusLabel(status).toLowerCase()} instruments.`
                        : `No ${instrumentStatusLabel(status).toLowerCase()} instruments are available to this account.`}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      )}
      {instruments.length ? (
        <CollectionPagination
          disabled={updating}
          hasNextPage={hasNextPage}
          isError={loadMoreError}
          isLoading={isLoadingMore}
          label="instruments"
          loaded={instruments.length}
          onLoadMore={onLoadMore}
          total={total}
        />
      ) : null}
    </>
  )
}
