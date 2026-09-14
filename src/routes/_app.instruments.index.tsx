import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { CollectionAffiliationFilter } from "@/components/crucible/collection-affiliation-filter"
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
import {
  instrumentPageLimit,
  instrumentsQueryOptions,
} from "@/data/crucible/instruments.queries"
import {
  collectionAffiliationSchema,
  collectionCursorSchema,
} from "@/data/crucible/collection-query"
import {
  instrumentStatusLabel,
  instrumentStatuses,
} from "@/data/crucible/instrument-status"
import type {
  WorkspaceInstrumentPage,
  WorkspaceInstrumentStatus,
} from "@/data/crucible/workspace-source"

const instrumentSearchSchema = z.object({
  affiliation: collectionAffiliationSchema.optional().catch(undefined),
  cursor: collectionCursorSchema,
  status: z.enum(instrumentStatuses).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/instruments/")({
  head: () => ({ meta: [{ title: "Instruments | Crucible Hub" }] }),
  validateSearch: instrumentSearchSchema,
  loaderDeps: ({ search }) => ({
    affiliation: search.affiliation,
    cursor: search.cursor,
    status: search.status ?? "active",
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const options = instrumentsQueryOptions(source.scope, {
      limit: instrumentPageLimit,
      ...deps,
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
  const status = search.status ?? "active"
  const instrumentResult = useQuery(
    instrumentsQueryOptions(scope, {
      affiliation: search.affiliation,
      cursor: search.cursor,
      limit: instrumentPageLimit,
      status,
    })
  )

  return (
    <PageLayout>
      <InstrumentsPageHeader canRegister={!account.is_service_account} />
      <InstrumentStatusNavigation
        affiliation={search.affiliation}
        status={status}
      />
      <InstrumentDirectoryFilters affiliation={search.affiliation} />
      {instrumentResult.isPending ? (
        <CollectionTablePending label="instruments" />
      ) : instrumentResult.isError && !instrumentResult.data ? (
        <>
          <CollectionLoadError
            label="Instruments"
            retry={() => void instrumentResult.refetch()}
          />
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
            affiliation={search.affiliation}
            instrumentPage={instrumentResult.data}
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
      <InstrumentStatusNavigation
        affiliation={search.affiliation}
        status={search.status ?? "active"}
      />
      <InstrumentDirectoryFilters affiliation={search.affiliation} />
      <CollectionTablePending label="instruments" />
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
      id="instrument-ownership"
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
      value={affiliation}
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
      eyebrow="Instruments"
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
            affiliation,
            cursor: undefined,
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
  affiliation,
  instrumentPage,
  status,
  updating,
}: {
  affiliation?: "owner"
  instrumentPage: WorkspaceInstrumentPage
  status: WorkspaceInstrumentStatus
  updating: boolean
}) {
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
                <col className="resource-directory-date-column hidden xl:table-column" />
                <col className="resource-directory-date-column" />
                <col className="resource-directory-action-column" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>Instrument</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    Created
                  </TableHead>
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
                {affiliation ? "No owned " : "No "}
                {instrumentStatusLabel(status).toLowerCase()} instruments are
                available to this account.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      )}
      {!updating && instrumentPage.nextCursor && (
        <nav
          className="flex items-center justify-end gap-2"
          aria-label="Instrument pages"
        >
          <Link
            className={buttonVariants({ variant: "outline" })}
            search={{
              affiliation,
              cursor: instrumentPage.nextCursor,
              status: status === "active" ? undefined : status,
            }}
            to="/instruments"
          >
            Next
          </Link>
        </nav>
      )}
    </>
  )
}
