import { useMemo } from "react"
import {
  useInfiniteQuery,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { resourceDisplayName } from "@/lib/resource-name"

import { CollectionAffiliationFilter } from "@/components/crucible/collection-affiliation-filter"
import { CollectionToolbar } from "@/components/crucible/collection-browser"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import {
  CollectionLoadError,
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { CreateResourceIcon } from "@/components/crucible/icons"
import { PersonLink } from "@/components/crucible/person-link"
import {
  ResourceCreatedCell,
  ResourceOpenCell,
  ResourceUpdatedCell,
} from "@/components/crucible/resource-collection-cells"
import { ResourceDirectoryNameCell } from "@/components/crucible/resource-directory-name-cell"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
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
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import {
  instrumentPageLimit,
  instrumentsCursorQueryOptions,
} from "@/data/crucible/instruments.queries"
import type { SortDirection } from "@/data/crucible/collection-query"
import {
  collectionAffiliationSchema,
  collectionCursorSchema,
  sortDirectionSchema,
} from "@/data/crucible/collection-query"
import {
  instrumentStatusLabel,
  instrumentStatuses,
} from "@/data/crucible/instrument-status"
import type {
  WorkspaceInstrument,
  WorkspaceInstrumentStatus,
} from "@/data/crucible/workspace-source"
import {
  cursorPageTotal,
  flattenCursorPages,
} from "@/data/crucible/cursor-pages"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"

const instrumentSortFieldSchema = z.enum(["name", "created", "updated"])
export type InstrumentSortField = z.infer<typeof instrumentSortFieldSchema>

const instrumentSearchSchema = z.object({
  affiliation: collectionAffiliationSchema.optional().catch(undefined),
  cursor: collectionCursorSchema,
  direction: sortDirectionSchema.optional().catch(undefined),
  sort: instrumentSortFieldSchema.optional().catch(undefined),
  status: z.enum(instrumentStatuses).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/instruments/")({
  head: () => ({ meta: [{ title: "Instruments | Crucible Hub" }] }),
  validateSearch: instrumentSearchSchema,
  loaderDeps: ({ search }) => ({
    affiliation: search.affiliation,
    cursor: search.cursor,
    direction: search.direction,
    sort: search.sort,
    status: search.status ?? "active",
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const options = instrumentsCursorQueryOptions(source.scope, {
      affiliation: deps.affiliation,
      cursor: deps.cursor,
      direction: deps.sort ? deps.direction : undefined,
      includeOwner: true,
      includeTotal: true,
      limit: instrumentPageLimit,
      sort: deps.sort,
      status: deps.status,
    })
    const request = prefetchInfiniteQueryWithReadableCache(
      context.queryClient,
      options
    )
    if (cause !== "stay" && request) await request
  },
  pendingComponent: InstrumentsRoutePending,
  staleTime: Infinity,
  component: InstrumentsPage,
})

function InstrumentsPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const status = search.status ?? "active"
  const sort = search.sort
  const direction = search.direction ?? "asc"
  const instrumentResult = useInfiniteQuery(
    instrumentsCursorQueryOptions(scope, {
      affiliation: search.affiliation,
      cursor: search.cursor,
      direction: search.sort ? search.direction : undefined,
      includeOwner: true,
      includeTotal: true,
      limit: instrumentPageLimit,
      sort: search.sort,
      status,
    })
  )
  const instruments = useMemo(
    () => flattenCursorPages(instrumentResult.data?.pages),
    [instrumentResult.data]
  )
  const total = cursorPageTotal(instrumentResult.data?.pages)
  const updating =
    instrumentResult.isFetching && !instrumentResult.isFetchingNextPage

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
      <InstrumentDirectoryNavigation
        affiliation={search.affiliation}
        status={status}
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
      <InstrumentDirectoryNavigation
        affiliation={search.affiliation}
        status={search.status ?? "active"}
      />
      <CollectionTablePending label="instruments" presentation="instruments" />
    </PageLayout>
  )
}

function InstrumentDirectoryFilters({
  affiliation,
}: {
  affiliation?: "owner"
}) {
  const navigate = Route.useNavigate()
  return (
    <CollectionAffiliationFilter
      onChange={(nextAffiliation) =>
        void navigate({
          search: (previous) => ({
            ...previous,
            affiliation: nextAffiliation,
            cursor: undefined,
          }),
          state: {},
          to: "/instruments",
        })
      }
      ownerLabel="Managed by me"
      value={affiliation}
    />
  )
}

function InstrumentDirectoryNavigation({
  affiliation,
  status,
}: {
  affiliation?: "owner"
  status: WorkspaceInstrumentStatus
}) {
  return (
    <CollectionToolbar
      actions={<InstrumentDirectoryFilters affiliation={affiliation} />}
      primary={
        <InstrumentStatusNavigation affiliation={affiliation} status={status} />
      }
    />
  )
}

function InstrumentsPageHeader({ canRegister }: { canRegister: boolean }) {
  return (
    <PageHeader
      actions={
        canRegister ? (
          <Link className={buttonVariants()} to="/instruments/new">
            <CreateResourceIcon data-icon="inline-start" />
            Register instrument
          </Link>
        ) : null
      }
      title="Instrument directory"
    />
  )
}

function InstrumentStatusNavigation({
  affiliation,
  status,
}: {
  affiliation?: "owner"
  status: WorkspaceInstrumentStatus
}) {
  const navigate = Route.useNavigate()
  const options = instrumentStatuses.map((candidate) => ({
    label: instrumentStatusLabel(candidate),
    value: candidate,
  }))

  return (
    <SegmentedControl
      ariaLabel="Instrument lifecycle status"
      onValueChange={(nextStatus) => {
        void navigate({
          search: (previous) => ({
            ...previous,
            affiliation,
            cursor: undefined,
            status: nextStatus === "active" ? undefined : nextStatus,
          }),
          state: {},
          to: "/instruments",
        })
      }}
      options={options}
      value={status}
    />
  )
}

function InstrumentCollection({
  affiliation,
  direction = "asc",
  hasNextPage,
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
  affiliation?: "owner"
  direction?: SortDirection
  hasNextPage: boolean
  instruments: readonly WorkspaceInstrument[]
  isLoadingMore: boolean
  loadMoreError: boolean
  onLoadMore: () => void
  onSortChange: (field: InstrumentSortField, direction: SortDirection) => void
  sort?: InstrumentSortField
  status: WorkspaceInstrumentStatus
  total: number | null
  updating: boolean
}) {
  return (
    <>
      <CollectionUpdateStatus label="instruments" updating={updating} />
      {instruments.length > 0 ? (
        <Card aria-busy={updating}>
          <CardContent className="px-0">
            <Table
              aria-label="Instrument directory"
              className="resource-directory-table resource-directory-instrument-table table-fixed"
            >
              <colgroup>
                <col className="resource-directory-name-column" />
                <col className="resource-directory-location-column" />
                <col className="resource-directory-person-column" />
                <col className="resource-directory-date-column hidden xl:table-column" />
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
                  <TableHead>Location</TableHead>
                  <TableHead>Manager</TableHead>
                  <SortableTableHead
                    active={sort === "created"}
                    className="hidden xl:table-cell"
                    direction={direction}
                    field="created"
                    kind="date"
                    label="Created"
                    onChange={onSortChange}
                    preferredDirection="desc"
                  />
                  <SortableTableHead
                    active={sort === "updated"}
                    direction={direction}
                    field="updated"
                    kind="date"
                    label="Updated"
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
                    <TableRow key={instrument.unique_id}>
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
                        className="hidden xl:table-cell"
                        value={instrument.creation_time}
                      />
                      <ResourceUpdatedCell
                        value={instrument.modification_time}
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
        </Card>
      ) : (
        <section aria-label="Instrument directory">
          <Empty className="min-h-state border">
            <EmptyHeader>
              <EmptyTitle>No instruments found</EmptyTitle>
              <EmptyDescription>
                {affiliation
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
