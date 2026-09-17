import { useQueries } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
  CollectionRowsPending,
  PanelState,
} from "@/components/crucible/collection-state"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import {
  datasetsQueryOptions,
  samplesQueryOptions,
} from "@/data/crucible/data.queries"
import { instrumentsQueryOptions } from "@/data/crucible/instruments.queries"
import { projectsQueryOptions } from "@/data/crucible/projects.queries"
import type { WorkspaceInstrument } from "@/data/crucible/workspace-source"
import { selectRecentResources } from "@/features/home/home-data"
import type { HomeRecentResource } from "@/features/home/home-data"
import { formatDate } from "@/lib/format"
import { useRecentlyViewed } from "@/features/recently-viewed/recently-viewed"
import type { RecentlyViewedResource } from "@/features/recently-viewed/recently-viewed"

const homeOwnershipLimit = 8
const homeRecentResourceLimit = 5
const homeProjectQuery = {
  affiliation: "owner",
  includeTotal: false,
  limit: homeOwnershipLimit,
} as const
const homeInstrumentQuery = {
  affiliation: "owner",
  includeOwner: false,
  includeTotal: false,
  limit: homeOwnershipLimit,
  status: "active",
} as const
const homeRecentResourceQuery = {
  direction: "desc",
  includeTotal: false,
  limit: homeRecentResourceLimit,
  sort: "created",
} as const

export const Route = createFileRoute("/_app/")({
  loader: async ({ context, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    void context.queryClient.prefetchQuery(
      projectsQueryOptions(source.scope, homeProjectQuery)
    )
    void context.queryClient.prefetchQuery(
      instrumentsQueryOptions(source.scope, homeInstrumentQuery)
    )
    void context.queryClient.prefetchQuery(
      samplesQueryOptions(source.scope, homeRecentResourceQuery)
    )
    void context.queryClient.prefetchQuery(
      datasetsQueryOptions(source.scope, homeRecentResourceQuery)
    )
  },
  component: HomePage,
})

function HomePage() {
  const scope = useWorkspaceScope()
  const [
    accountResult,
    projectResult,
    instrumentResult,
    sampleResult,
    datasetResult,
  ] = useQueries({
    queries: [
      accountQueryOptions(scope),
      projectsQueryOptions(scope, homeProjectQuery),
      instrumentsQueryOptions(scope, homeInstrumentQuery),
      samplesQueryOptions(scope, homeRecentResourceQuery),
      datasetsQueryOptions(scope, homeRecentResourceQuery),
    ],
  })
  const account = accountResult.data
  const projects = projectResult.data?.items ?? []
  const instruments = instrumentResult.data?.items ?? []
  const recentResources = selectRecentResources(
    sampleResult.data?.items ?? [],
    datasetResult.data?.items ?? [],
    homeRecentResourceLimit
  )
  const recentDataPending =
    recentResources.length === 0 &&
    (sampleResult.isPending || datasetResult.isPending)
  const recentDataUnavailable =
    recentResources.length === 0 &&
    (sampleResult.isError || datasetResult.isError)
  const recentDataPartial =
    recentResources.length > 0 &&
    (sampleResult.isError || datasetResult.isError)
  const recentlyViewed = useRecentlyViewed().slice(0, 5)

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Research workspace"
        title={`Welcome back, ${account?.first_name ?? "researcher"}`}
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-3">
          <section aria-labelledby="recent-research-title" className="min-w-0">
            <Card>
              <CardHeader actionLayout="inline">
                <CardTitle>
                  <h2 id="recent-research-title">Recently added data</h2>
                </CardTitle>
                <CardAction>
                  <Link
                    className={buttonVariants({ variant: "ghost" })}
                    search={{ kind: undefined }}
                    to="/data"
                  >
                    View all
                    <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent>
                {recentDataPending && (
                  <CollectionRowsPending label="recent research data" />
                )}
                {recentDataUnavailable && (
                  <PanelState
                    description="Projects and navigation remain available."
                    retry={() => {
                      void sampleResult.refetch()
                      void datasetResult.refetch()
                    }}
                    role="alert"
                    title={
                      sampleResult.isError && datasetResult.isError
                        ? "Recent data could not be loaded"
                        : "Recent data could not be fully loaded"
                    }
                  />
                )}
                {!recentDataPending &&
                  !recentDataUnavailable &&
                  recentResources.length === 0 && (
                    <PanelState
                      description="New samples and datasets will appear here."
                      title="No data is available yet"
                    />
                  )}
                {recentDataPartial && (
                  <div
                    className="mb-3 flex flex-wrap items-center justify-between gap-3"
                    role="alert"
                  >
                    <p className="text-body text-muted-foreground">
                      Some recent data could not be loaded.
                    </p>
                    <Button
                      onClick={() => {
                        if (sampleResult.isError) void sampleResult.refetch()
                        if (datasetResult.isError) void datasetResult.refetch()
                      }}
                      size="sm"
                      variant="outline"
                    >
                      Try again
                    </Button>
                  </div>
                )}
                {recentResources.length > 0 && (
                  <ul className="flex min-w-0 flex-col gap-2" role="list">
                    {recentResources.map((item) => (
                      <HomeResourceLink
                        item={{
                          kind: item.kind,
                          name: recentResourceName(item),
                          projectId: recentResourceProjectId(item),
                          timestamp: item.resource.creation_time
                            ? {
                                label: "Created",
                                value: item.resource.creation_time,
                              }
                            : null,
                          uniqueId: item.resource.unique_id,
                        }}
                        key={`${item.kind}:${item.resource.unique_id}`}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
          <section aria-labelledby="recently-viewed-title">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 id="recently-viewed-title">Recently viewed</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentlyViewed.length === 0 ? (
                  <p className="text-body text-muted-foreground">
                    Resources opened during this session will appear here.
                  </p>
                ) : (
                  <ul className="flex min-w-0 flex-col gap-2" role="list">
                    {recentlyViewed.map((item) => (
                      <HomeResourceLink
                        item={{
                          kind: item.kind,
                          name: item.name,
                          projectId: item.projectId,
                          timestamp: {
                            label: "Viewed",
                            value: item.viewedAt,
                          },
                          uniqueId: item.uniqueId,
                        }}
                        key={`${item.kind}:${item.uniqueId}`}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <HomeOwnershipCard
            emptyDescription="Projects you lead will appear here."
            emptyTitle="You do not lead any projects yet"
            error={projectResult.isError && !projectResult.data}
            label="projects you lead"
            pending={projectResult.isPending}
            retry={() => void projectResult.refetch()}
            title="Projects you lead"
            viewAll={
              <Link
                className={buttonVariants({ variant: "ghost" })}
                search={{ affiliation: "owner", cursor: undefined }}
                to="/projects"
              >
                View all
                <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
              </Link>
            }
          >
            {projects.length > 0 ? (
              <ul className="flex min-w-0 flex-col gap-2" role="list">
                {projects.map((project) => (
                  <OwnershipResourceLink
                    identifier={project.project_id}
                    kind="project"
                    key={project.unique_id}
                    mfid={project.unique_id}
                    name={project.title?.trim() || project.project_id}
                  />
                ))}
              </ul>
            ) : null}
          </HomeOwnershipCard>

          <HomeOwnershipCard
            emptyDescription="Active instruments you manage will appear here."
            emptyTitle="You do not manage any active instruments yet"
            error={instrumentResult.isError && !instrumentResult.data}
            label="instruments you manage"
            pending={instrumentResult.isPending}
            retry={() => void instrumentResult.refetch()}
            title="Instruments you manage"
            viewAll={
              <Link
                className={buttonVariants({ variant: "ghost" })}
                search={{
                  affiliation: "owner",
                  cursor: undefined,
                  status: undefined,
                }}
                to="/instruments"
              >
                View all
                <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
              </Link>
            }
          >
            {instruments.length > 0 ? (
              <ul className="flex min-w-0 flex-col gap-2" role="list">
                {instruments.map((instrument) => (
                  <OwnershipResourceLink
                    identifier={instrument.instrument_id}
                    kind="instrument"
                    key={instrument.unique_id}
                    mfid={instrument.unique_id}
                    name={instrumentName(instrument)}
                  />
                ))}
              </ul>
            ) : null}
          </HomeOwnershipCard>
        </div>
      </div>
    </PageLayout>
  )
}

type HomeResourceLinkItem = {
  kind: RecentlyViewedResource["kind"]
  name: string
  projectId: string | null
  timestamp: {
    label: "Created" | "Viewed"
    value: string
  } | null
  uniqueId: string
}

function HomeResourceLink({ item }: { item: HomeResourceLinkItem }) {
  const content = (
    <>
      <ResourceIdentity
        className="flex-1"
        interactive
        kind={item.kind}
        mfid={item.uniqueId}
        name={item.name}
        presentation="collection"
        projectId={item.projectId}
      />
      {item.timestamp ? (
        <time
          className="shrink-0 text-supporting text-muted-foreground sm:text-right"
          dateTime={item.timestamp.value}
        >
          <span className="block">{item.timestamp.label}</span>
          <span className="block">{formatDate(item.timestamp.value)}</span>
        </time>
      ) : null}
    </>
  )
  const className =
    "group/resource flex min-w-0 flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-start"

  if (item.kind === "project") {
    return (
      <li>
        <Link
          aria-label={"Open " + item.kind + ": " + item.name}
          className={className}
          params={{ projectMfid: item.uniqueId }}
          search={{ preview: undefined }}
          state={{}}
          to="/projects/$projectMfid"
        >
          {content}
        </Link>
      </li>
    )
  }
  if (item.kind === "instrument") {
    return (
      <li>
        <Link
          aria-label={"Open " + item.kind + ": " + item.name}
          className={className}
          params={{ instrumentMfid: item.uniqueId }}
          search={{}}
          state={{}}
          to="/instruments/$instrumentMfid"
        >
          {content}
        </Link>
      </li>
    )
  }
  if (item.kind === "sample") {
    return (
      <li>
        <Link
          aria-label={"Open " + item.kind + ": " + item.name}
          className={className}
          params={{ sampleMfid: item.uniqueId }}
          to="/samples/$sampleMfid"
        >
          {content}
        </Link>
      </li>
    )
  }
  return (
    <li>
      <Link
        aria-label={"Open " + item.kind + ": " + item.name}
        className={className}
        params={{ datasetMfid: item.uniqueId }}
        to="/datasets/$datasetMfid"
      >
        {content}
      </Link>
    </li>
  )
}

function HomeOwnershipCard({
  children,
  emptyDescription,
  emptyTitle,
  error,
  label,
  pending,
  retry,
  title,
  viewAll,
}: {
  children: ReactNode
  emptyDescription: string
  emptyTitle: string
  error: boolean
  label: string
  pending: boolean
  retry: () => void
  title: string
  viewAll: ReactNode
}) {
  const titleId = `home-${label.replaceAll(" ", "-")}-title`
  const hasContent = children !== null

  return (
    <section aria-labelledby={titleId} className="min-w-0">
      <Card>
        <CardHeader actionLayout="inline">
          <CardTitle>
            <h2 id={titleId}>{title}</h2>
          </CardTitle>
          <CardAction>{viewAll}</CardAction>
        </CardHeader>
        <CardContent>
          {pending ? <CollectionRowsPending label={label} /> : null}
          {!pending && error ? (
            <PanelState
              retry={retry}
              role="alert"
              title={`${title} could not be loaded`}
            />
          ) : null}
          {!pending && !error && !hasContent ? (
            <PanelState description={emptyDescription} title={emptyTitle} />
          ) : null}
          {hasContent ? children : null}
        </CardContent>
      </Card>
    </section>
  )
}

function OwnershipResourceLink({
  identifier,
  kind,
  mfid,
  name,
}: {
  identifier?: string | null
  kind: "instrument" | "project"
  mfid: string
  name: string
}) {
  const content = (
    <>
      <ResourceIdentity
        className="flex-1"
        context={identifier}
        interactive
        kind={kind}
        name={name}
        presentation="collection"
      />
      <ArrowRightIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
    </>
  )
  const className =
    "group/resource flex min-w-0 items-start gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50"

  return kind === "project" ? (
    <li>
      <Link
        aria-label={`Open project: ${name}`}
        className={className}
        params={{ projectMfid: mfid }}
        search={{ preview: undefined }}
        state={{}}
        to="/projects/$projectMfid"
      >
        {content}
      </Link>
    </li>
  ) : (
    <li>
      <Link
        aria-label={`Open instrument: ${name}`}
        className={className}
        params={{ instrumentMfid: mfid }}
        search={{}}
        state={{}}
        to="/instruments/$instrumentMfid"
      >
        {content}
      </Link>
    </li>
  )
}

function instrumentName(instrument: WorkspaceInstrument) {
  return (
    instrument.instrument_name.trim() ||
    instrument.instrument_id?.trim() ||
    instrument.unique_id
  )
}

function recentResourceName(item: HomeRecentResource) {
  return item.kind === "dataset"
    ? (item.resource.dataset_name ?? "Untitled dataset")
    : item.resource.sample_name
}

function recentResourceProjectId(item: HomeRecentResource) {
  return item.resource.project?.project_id ?? item.resource.project_id ?? null
}
