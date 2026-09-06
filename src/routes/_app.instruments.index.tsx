import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRightIcon, MapPinIcon } from "lucide-react"
import { z } from "zod"

import {
  CollectionCardGridPending,
  CollectionLoadError,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { RouteContentPending } from "@/components/crucible/route-content-pending"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  instrumentPageLimit,
  instrumentsQueryOptions,
} from "@/data/crucible/instruments.queries"
import type { WorkspaceInstrumentPage } from "@/data/crucible/workspace-source"
import { formatDate } from "@/lib/format"

const instrumentSearchSchema = z.object({
  offset: z.coerce.number().int().min(0).catch(0).optional(),
})

export const Route = createFileRoute("/_app/instruments/")({
  validateSearch: instrumentSearchSchema,
  loaderDeps: ({ search }) => ({ offset: search.offset ?? 0 }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const options = instrumentsQueryOptions(source.scope, {
      limit: instrumentPageLimit,
      offset: deps.offset,
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
  pendingComponent: RouteContentPending,
  component: InstrumentsPage,
})

function InstrumentsPage() {
  const scope = useWorkspaceScope()
  const search = Route.useSearch()
  const offset = search.offset ?? 0
  const instrumentResult = useQuery(
    instrumentsQueryOptions(scope, { limit: instrumentPageLimit, offset })
  )

  return (
    <PageLayout>
      <PageHeader eyebrow="Instruments" title="Instrument directory" />
      {instrumentResult.isPending ? (
        <CollectionCardGridPending label="instruments" />
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
            updating={instrumentResult.isFetching}
          />
        </>
      )}
    </PageLayout>
  )
}

function InstrumentCollection({
  instrumentPage,
  offset,
  updating,
}: {
  instrumentPage: WorkspaceInstrumentPage
  offset: number
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
      <section
        aria-busy={updating}
        className="grid gap-4 lg:grid-cols-2"
        aria-label="Instrument directory"
      >
        {instrumentPage.items.map((instrument) => (
          <Card key={instrument.unique_id}>
            <CardHeader>
              <div className="mb-2 flex items-center justify-between gap-3">
                <ResourceTypeIcon
                  className="text-(--resource-instrument)"
                  type="instrument"
                />
                <Badge variant="secondary">{instrument.status}</Badge>
              </div>
              <CardTitle>{instrument.instrument_name}</CardTitle>
              <CardDescription>{instrument.instrument_type}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-body text-muted-foreground">
                {instrument.description}
              </p>
              <dl className="grid gap-3 text-body sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Location</dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-label">
                    <MapPinIcon aria-hidden="true" />
                    {instrument.location}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Model</dt>
                  <dd className="mt-1 text-label">
                    {instrument.manufacturer} {instrument.model}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Owner</dt>
                  <dd className="mt-1 text-label">
                    {instrument.owner?.username ?? "Unknown owner"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Updated</dt>
                  <dd className="mt-1 text-label">
                    {formatDate(instrument.modification_time)}
                  </dd>
                </div>
              </dl>
              <Link
                className={buttonVariants({ variant: "outline" })}
                params={{ instrumentMfid: instrument.unique_id }}
                to="/instruments/$instrumentMfid"
              >
                Open instrument
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        ))}
        {instrumentPage.items.length === 0 && (
          <Empty className="lg:col-span-2">
            <EmptyHeader>
              <EmptyTitle>No instruments found</EmptyTitle>
              <EmptyDescription>
                No active instruments are available to this account.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
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
              }}
              to="/instruments"
            >
              Previous
            </Link>
          )}
          {hasNext && (
            <Link
              className={buttonVariants({ variant: "outline" })}
              search={{ offset: nextOffset }}
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
