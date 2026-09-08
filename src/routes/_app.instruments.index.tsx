import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  CollectionLoadError,
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { CreateResourceIcon } from "@/components/crucible/icons"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceDirectoryNameCell } from "@/components/crucible/resource-directory-name-cell"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
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
import {
  instrumentPageLimit,
  instrumentsQueryOptions,
} from "@/data/crucible/instruments.queries"
import {
  instrumentStatusLabel,
  instrumentStatuses,
} from "@/data/crucible/instrument-status"
import type {
  WorkspaceInstrumentPage,
  WorkspaceInstrumentStatus,
} from "@/data/crucible/workspace-source"
import { formatDate } from "@/lib/format"

const instrumentSearchSchema = z.object({
  offset: z.coerce.number().int().min(0).catch(0).optional(),
  status: z.enum(instrumentStatuses).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/instruments/")({
  head: () => ({ meta: [{ title: "Instruments | Crucible Hub" }] }),
  validateSearch: instrumentSearchSchema,
  loaderDeps: ({ search }) => ({
    offset: search.offset ?? 0,
    status: search.status ?? "active",
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const options = instrumentsQueryOptions(source.scope, {
      limit: instrumentPageLimit,
      offset: deps.offset,
      status: deps.status,
    })
    const hasData =
      context.queryClient.getQueryData(options.queryKey) !== undefined
    const request = context.queryClient.prefetchQuery(options)
    if (cause === "stay" || hasData) {
      void request
      return
    }

    await request
  },
  pendingComponent: InstrumentsRoutePending,
  component: InstrumentsPage,
})

function InstrumentsPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const search = Route.useSearch()
  const offset = search.offset ?? 0
  const status = search.status ?? "active"
  const instrumentResult = useQuery(
    instrumentsQueryOptions(scope, {
      limit: instrumentPageLimit,
      offset,
      status,
    })
  )

  return (
    <PageLayout>
      <InstrumentsPageHeader canRegister={!account.is_service_account} />
      <InstrumentStatusNavigation status={status} />
      {instrumentResult.isPending ? (
        <CollectionTablePending label="instruments" />
      ) : instrumentResult.isError && !instrumentResult.data ? (
        <>
          <CollectionLoadError
            label="Instruments"
            retry={() => void instrumentResult.refetch()}
          />
          {offset > 0 ? (
            <nav className="flex justify-end" aria-label="Instrument pages">
              <Link
                className={buttonVariants({ variant: "outline" })}
                search={{
                  offset:
                    Math.max(0, offset - instrumentPageLimit) || undefined,
                  status: status === "active" ? undefined : status,
                }}
                to="/instruments"
              >
                Previous
              </Link>
            </nav>
          ) : null}
        </>
      ) : (
        <>
          {instrumentResult.isError ? (
            <CollectionUpdateError
              label="Instruments"
              preserved
              retry={() => void instrumentResult.refetch()}
            />
          ) : null}
          <InstrumentCollection
            instrumentPage={instrumentResult.data}
            offset={offset}
            status={status}
            updating={instrumentResult.isFetching}
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
        canRegister={account?.is_service_account === false}
      />
      <InstrumentStatusNavigation status={search.status ?? "active"} />
      <CollectionTablePending label="instruments" />
    </PageLayout>
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
      eyebrow="Instruments"
      title="Instrument directory"
    />
  )
}

function InstrumentStatusNavigation({
  status,
}: {
  status: WorkspaceInstrumentStatus
}) {
  return (
    <nav
      aria-label="Instrument lifecycle status"
      className="flex flex-wrap gap-2"
    >
      {instrumentStatuses.map((candidate) => (
        <Link
          activeOptions={{ exact: true, explicitUndefined: true }}
          aria-current={candidate === status ? "page" : undefined}
          className={buttonVariants({
            variant: candidate === status ? "secondary" : "ghost",
          })}
          key={candidate}
          search={{
            offset: undefined,
            status: candidate === "active" ? undefined : candidate,
          }}
          to="/instruments"
        >
          {instrumentStatusLabel(candidate)}
        </Link>
      ))}
    </nav>
  )
}

function InstrumentCollection({
  instrumentPage,
  offset,
  status,
  updating,
}: {
  instrumentPage: WorkspaceInstrumentPage
  offset: number
  status: WorkspaceInstrumentStatus
  updating: boolean
}) {
  const previousOffset = Math.max(0, offset - instrumentPageLimit)
  const nextOffset = offset + instrumentPage.items.length
  const hasNext =
    instrumentPage.items.length === instrumentPageLimit &&
    (instrumentPage.total === null || nextOffset < instrumentPage.total)

  return (
    <>
      <CollectionUpdateStatus label="instruments" updating={updating} />
      {instrumentPage.items.length > 0 ? (
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
                <col className="resource-directory-date-column" />
                <col className="resource-directory-action-column" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>Instrument</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-center">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instrumentPage.items.map((instrument) => {
                  const instrumentId = instrument.instrument_id?.trim()
                  const name =
                    instrument.instrument_name.trim() ||
                    instrumentId ||
                    instrument.unique_id
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
                        data-label="Owner"
                      >
                        {instrument.owner ? (
                          <PersonLink
                            nameStyle="abbreviated"
                            person={instrument.owner}
                          />
                        ) : (
                          <span aria-label="Not available">-</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="resource-directory-date"
                        data-label="Updated"
                      >
                        {instrument.modification_time
                          ? formatDate(instrument.modification_time)
                          : "-"}
                      </TableCell>
                      <TableCell className="resource-directory-action text-center">
                        <ResourceFullPageLink
                          kind="instrument"
                          mfid={instrument.unique_id}
                          name={name}
                          presentation="table"
                        />
                      </TableCell>
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
                No {instrumentStatusLabel(status).toLowerCase()} instruments are
                available to this account.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      )}
      {!updating && (offset > 0 || hasNext) && (
        <nav
          className="flex items-center justify-end gap-2"
          aria-label="Instrument pages"
        >
          {offset > 0 && (
            <Link
              className={buttonVariants({ variant: "outline" })}
              search={{
                offset: previousOffset === 0 ? undefined : previousOffset,
                status: status === "active" ? undefined : status,
              }}
              to="/instruments"
            >
              Previous
            </Link>
          )}
          {hasNext && (
            <Link
              className={buttonVariants({ variant: "outline" })}
              search={{
                offset: nextOffset,
                status: status === "active" ? undefined : status,
              }}
              to="/instruments"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  )
}
