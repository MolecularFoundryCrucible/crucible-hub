import { useQueries } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"

import {
  PanelState,
  ResourceListPending,
} from "@/components/crucible/collection-state"
import {
  CreateResourceIcon,
  ForwardNavigationIcon,
} from "@/components/crucible/icons"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { ProjectRoleBadge } from "@/components/crucible/project-members"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceNameLink } from "@/components/crucible/resource-name-link"
import {
  ResourceList,
  ResourceListItem,
  ResourceListItemContent,
} from "@/components/crucible/resource-list"
import { SegmentedControl } from "@/components/crucible/segmented-control"
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
import {
  homeInstrumentQuery,
  homeProjectLimit,
  homeRecentResourceLimit,
  homeRecentResourceQuery,
  recentScopeOptions,
  useRecentResourcesSnapshot,
} from "@/features/home/home-data"
import type { HomeRecentResource } from "@/features/home/home-data"
import { useHomeGreeting } from "@/features/home/home-greeting"
import { useAccountPreferences } from "@/features/preferences/use-account-preferences"
import { useRecentlyViewed } from "@/features/recently-viewed/recently-viewed"
import type { RecentlyViewedResource } from "@/features/recently-viewed/recently-viewed"
import { resourceDisplayName } from "@/lib/resource-name"

export const Route = createFileRoute("/_app/")({
  loader: async ({ context, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    await Promise.allSettled([
      context.queryClient.prefetchQuery(
        projectsQueryOptions(source.scope, {
          direction: "desc",
          includeTotal: false,
          limit: homeProjectLimit,
          memberRef: source.scope[2],
          sort: "activity",
        })
      ),
      context.queryClient.prefetchQuery(
        instrumentsQueryOptions(source.scope, homeInstrumentQuery)
      ),
      context.queryClient.prefetchQuery(
        samplesQueryOptions(source.scope, homeRecentResourceQuery)
      ),
      context.queryClient.prefetchQuery(
        datasetsQueryOptions(source.scope, homeRecentResourceQuery)
      ),
    ])
  },
  component: HomePage,
})

function HomePage() {
  const scope = useWorkspaceScope()
  const { preferences } = useAccountPreferences()
  const [chosenRecentScope, setRecentScope] = useState<"all" | "mine">()
  const recentScope =
    chosenRecentScope ?? preferences.hub?.home_recent_scope ?? "all"
  const homeProjectQuery = useMemo(
    () => ({
      direction: "desc" as const,
      includeTotal: false,
      limit: homeProjectLimit,
      memberRef: scope[2],
      sort: "activity" as const,
    }),
    [scope]
  )
  const recentResourceFilters = useMemo(
    () => ({
      ...homeRecentResourceQuery,
      ...(recentScope === "mine" ? { affiliation: "owner" as const } : {}),
    }),
    [recentScope]
  )
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
      samplesQueryOptions(scope, recentResourceFilters),
      datasetsQueryOptions(scope, recentResourceFilters),
    ],
  })
  const account = accountResult.data
  const greeting = useHomeGreeting({
    accountMfid: account?.unique_id,
    firstName: account?.first_name,
  })
  const projects = projectResult.data?.items ?? []
  const instruments = instrumentResult.data?.items ?? []
  const recentSnapshot = useRecentResourcesSnapshot({
    datasets: datasetResult.data?.items,
    datasetsFetching: datasetResult.isFetching,
    identity: `${JSON.stringify(scope)}:${recentScope}`,
    limit: homeRecentResourceLimit,
    samples: sampleResult.data?.items,
    samplesFetching: sampleResult.isFetching,
  })
  const recentResources = recentSnapshot.resources
  const recentDataPending = recentSnapshot.pending
  const recentDataUnavailable =
    !recentDataPending &&
    recentResources.length === 0 &&
    (sampleResult.isError || datasetResult.isError)
  const recentDataPartial =
    !recentDataPending &&
    recentResources.length > 0 &&
    (sampleResult.isError || datasetResult.isError)
  const recentlyViewed = useRecentlyViewed().slice(0, 5)

  return (
    <PageLayout>
      <PageHeader title={greeting} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-3">
          <section aria-labelledby="recent-research-title" className="min-w-0">
            <Card>
              <CardHeader actionLayout="responsive">
                <CardTitle>
                  <h2 id="recent-research-title">Recently added data</h2>
                </CardTitle>
                <CardAction className="flex flex-wrap items-center gap-2">
                  <SegmentedControl
                    ariaLabel="Recent data scope"
                    onValueChange={setRecentScope}
                    options={recentScopeOptions}
                    value={recentScope}
                  />
                  <Link
                    className={buttonVariants({ variant: "ghost" })}
                    search={{
                      affiliation: recentScope === "mine" ? "owner" : undefined,
                      kind: undefined,
                    }}
                    to="/data"
                  >
                    View all
                    <ForwardNavigationIcon
                      aria-hidden="true"
                      data-icon="inline-end"
                    />
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent>
                {recentDataPending && (
                  <ResourceListPending label="recent research data" />
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
                      description={
                        recentScope === "mine"
                          ? "Samples and datasets you create will appear here."
                          : "New samples and datasets will appear here."
                      }
                      title={
                        recentScope === "mine"
                          ? "You have not added any data yet"
                          : "No data is available yet"
                      }
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
                  <ResourceList>
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
                  </ResourceList>
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
                  <ResourceList>
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
                  </ResourceList>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <HomeOwnershipCard
            emptyAction={
              account?.capabilities.can_create_project ? (
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  to="/projects/new"
                >
                  <CreateResourceIcon data-icon="inline-start" />
                  Create project
                </Link>
              ) : undefined
            }
            emptyDescription="Projects you belong to will appear here."
            emptyTitle="You do not belong to any projects yet"
            error={projectResult.isError && !projectResult.data}
            label="your projects"
            pending={projectResult.isPending}
            retry={() => void projectResult.refetch()}
            title="Your projects"
            viewAll={
              <Link
                className={buttonVariants({ variant: "ghost" })}
                search={{ cursor: undefined }}
                to="/projects"
              >
                View all
                <ForwardNavigationIcon
                  aria-hidden="true"
                  data-icon="inline-end"
                />
              </Link>
            }
          >
            {projects.length > 0 ? (
              <ResourceList>
                {projects.map((project) => (
                  <OwnershipResourceLink
                    identifier={project.project_id}
                    kind="project"
                    key={project.unique_id}
                    mfid={project.unique_id}
                    name={resourceDisplayName("project", project.title, {
                      identifier: project.project_id,
                      mfid: project.unique_id,
                    })}
                    role={project.role}
                  />
                ))}
              </ResourceList>
            ) : null}
          </HomeOwnershipCard>

          <HomeOwnershipCard
            emptyAction={
              account?.capabilities.can_register_instrument ? (
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  to="/instruments/new"
                >
                  <CreateResourceIcon data-icon="inline-start" />
                  Register instrument
                </Link>
              ) : undefined
            }
            emptyDescription="Active instruments you manage will appear here."
            emptyTitle="You do not manage any active instruments yet"
            error={instrumentResult.isError && !instrumentResult.data}
            label="your instruments"
            pending={instrumentResult.isPending}
            retry={() => void instrumentResult.refetch()}
            title="Your instruments"
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
                <ForwardNavigationIcon
                  aria-hidden="true"
                  data-icon="inline-end"
                />
              </Link>
            }
          >
            {instruments.length > 0 ? (
              <ResourceList>
                {instruments.map((instrument) => (
                  <OwnershipResourceLink
                    identifier={instrument.instrument_id}
                    kind="instrument"
                    key={instrument.unique_id}
                    mfid={instrument.unique_id}
                    name={instrumentName(instrument)}
                    role={instrument.role}
                  />
                ))}
              </ResourceList>
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
  const name = resourceDisplayName(item.kind, item.name, {
    mfid: item.uniqueId,
  })
  return (
    <ResourceListItem>
      <ResourceListItemContent className="select-text" layout="responsive">
        <ResourceIdentity
          className="w-full flex-1"
          kind={item.kind}
          mfid={item.uniqueId}
          name={name}
          nameContent={
            <ResourceNameLink
              kind={item.kind}
              mfid={item.uniqueId}
              name={name}
            />
          }
          presentation="collection"
          projectId={item.projectId}
        />
        {item.timestamp ? (
          <div className="flex shrink-0 flex-wrap items-baseline gap-x-1.5 text-supporting text-muted-foreground sm:block sm:text-right">
            <span className="sm:block">{item.timestamp.label}</span>
            <LocalDateTime className="sm:block" value={item.timestamp.value} />
          </div>
        ) : null}
      </ResourceListItemContent>
    </ResourceListItem>
  )
}

function HomeOwnershipCard({
  children,
  emptyAction,
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
  emptyAction?: ReactNode
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
          {pending ? (
            <ResourceListPending label={label} trailing={false} />
          ) : null}
          {!pending && error ? (
            <PanelState
              retry={retry}
              role="alert"
              title={`${title} could not be loaded`}
            />
          ) : null}
          {!pending && !error && !hasContent ? (
            <PanelState
              action={emptyAction}
              description={emptyDescription}
              title={emptyTitle}
            />
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
  role,
}: {
  identifier?: string | null
  kind: "instrument" | "project"
  mfid: string
  name: string
  role?: string | null
}) {
  return (
    <ResourceListItem>
      <ResourceListItemContent
        className="select-text"
        density="compact"
        layout="row"
      >
        <ResourceIdentity
          className="min-w-0 flex-1"
          context={identifier}
          kind={kind}
          name={name}
          nameContent={<ResourceNameLink kind={kind} mfid={mfid} name={name} />}
          presentation="collection"
        />
        {role ? (
          <div className="shrink-0">
            <ProjectRoleBadge role={role} />
          </div>
        ) : null}
      </ResourceListItemContent>
    </ResourceListItem>
  )
}

function instrumentName(instrument: WorkspaceInstrument) {
  return resourceDisplayName("instrument", instrument.instrument_name, {
    identifier: instrument.instrument_id,
    mfid: instrument.unique_id,
  })
}

function recentResourceName(item: HomeRecentResource) {
  return item.kind === "dataset"
    ? resourceDisplayName("dataset", item.resource.dataset_name)
    : resourceDisplayName("sample", item.resource.sample_name)
}

function recentResourceProjectId(item: HomeRecentResource) {
  return item.resource.project?.project_id ?? item.resource.project_id ?? null
}
