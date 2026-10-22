import { accountPreferencesQueryOptions } from "@/data/crucible/preferences.queries"
import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import { useIncludePublicByDefault } from "@/features/preferences/public-data"
import { buttonVariants, Button } from "@/components/ui/button"
import { hashKey, useQueries } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"

import { CardViewAllLink } from "@/components/crucible/card-view-all-link"
import {
  PanelState,
  ResourceListPending,
} from "@/components/crucible/collection-state"
import { LabeledTimestamp } from "@/components/crucible/labeled-timestamp"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceCreationLink } from "@/components/crucible/resource-creation-actions"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceNameLink } from "@/components/crucible/resource-name-link"
import {
  ResourceList,
  ResourceListItem,
  ResourceListItemContent,
} from "@/components/crucible/resource-list"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
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
  homeRecentResourceFilters,
  recentScopeOptions,
  useRecentResourcesSnapshot,
} from "@/features/home/home-data"
import type { HomeRecentResource } from "@/features/home/home-data"
import { homeGreeting } from "@/features/home/home-greeting"
import { useViewerPresentation } from "@/hooks/use-viewer-presentation"
import { useAccountPreferences } from "@/features/preferences/use-account-preferences"
import { useRecentlyViewed } from "@/features/recently-viewed/recently-viewed"
import type { RecentlyViewedResource } from "@/features/recently-viewed/recently-viewed"
import { resourceDisplayName } from "@/lib/resource-name"

export const Route = createFileRoute("/_app/")({
  loader: async ({ context, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const preferences = source.accountPreferencesEnabled
      ? (
          await context.queryClient
            .ensureQueryData(accountPreferencesQueryOptions(source.scope))
            .catch(() => undefined)
        )?.preferences
      : undefined
    const recentFilters = homeRecentResourceFilters({
      elevated: privilegeModeFromScope(source.scope) === "elevated",
      includePublicByDefault: preferences?.hub?.include_public_data === true,
      recentScope: preferences?.hub?.home_recent_scope ?? "all",
    })

    const sampleOptions = samplesQueryOptions(source.scope, recentFilters)
    const datasetOptions = datasetsQueryOptions(source.scope, recentFilters)
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
      context.queryClient.prefetchQuery(sampleOptions),
      context.queryClient.prefetchQuery(datasetOptions),
    ])
    return {
      failedRecentQueries: [sampleOptions, datasetOptions]
        .filter(
          (options) =>
            context.queryClient.getQueryState(options.queryKey)?.status ===
            "error"
        )
        .map((options) => hashKey(options.queryKey)),
      greetingAt: Date.now(),
    }
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
  const includePublicByDefault = useIncludePublicByDefault()
  const elevated = privilegeModeFromScope(scope) === "elevated"
  const recentResourceFilters = useMemo(
    () =>
      homeRecentResourceFilters({
        elevated,
        includePublicByDefault,
        recentScope,
      }),
    [elevated, includePublicByDefault, recentScope]
  )
  const offerPublicData = recentResourceFilters.affiliation === "member"
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
  const { timeZone } = useViewerPresentation()
  const loadedGreetingAt = Route.useLoaderData()?.greetingAt
  // Keep the first greeting while loaders rerun, e.g. on an access mode switch.
  const [greetingAt] = useState(loadedGreetingAt)
  const greeting = homeGreeting({
    accountMfid: account?.unique_id,
    at: greetingAt ?? 0,
    firstName: account?.first_name,
    timeZone: greetingAt ? timeZone : undefined,
  })
  // Failed queries are not dehydrated, so until the browser retries them the
  // server's failure decides the first render and hydration matches.
  const failedOnServer = Route.useLoaderData()?.failedRecentQueries ?? []
  const retryingServerFailure = (
    result: { data: unknown; isFetching: boolean },
    queryKey: readonly unknown[]
  ) =>
    result.data === undefined &&
    result.isFetching &&
    failedOnServer.includes(hashKey(queryKey))
  const samplesRetrying = retryingServerFailure(
    sampleResult,
    samplesQueryOptions(scope, recentResourceFilters).queryKey
  )
  const datasetsRetrying = retryingServerFailure(
    datasetResult,
    datasetsQueryOptions(scope, recentResourceFilters).queryKey
  )
  const projects = projectResult.data?.items ?? []
  const instruments = instrumentResult.data?.items ?? []
  const recentSnapshot = useRecentResourcesSnapshot({
    datasets: datasetResult.data?.items,
    datasetsFetching: datasetResult.isFetching && !datasetsRetrying,
    identity: `${JSON.stringify(scope)}:${recentScope}`,
    limit: homeRecentResourceLimit,
    samples: sampleResult.data?.items,
    samplesFetching: sampleResult.isFetching && !samplesRetrying,
  })
  const recentResources = recentSnapshot.resources
  const recentDataPending = recentSnapshot.pending
  const recentDataFailed =
    sampleResult.isError ||
    datasetResult.isError ||
    samplesRetrying ||
    datasetsRetrying
  const recentDataUnavailable =
    !recentDataPending && recentResources.length === 0 && recentDataFailed
  const recentDataPartial =
    !recentDataPending && recentResources.length > 0 && recentDataFailed
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
                  <CardViewAllLink
                    render={
                      <Link
                        search={{
                          affiliation:
                            recentScope === "mine" ? "owner" : undefined,
                          kind: undefined,
                        }}
                        to="/data"
                      />
                    }
                  />
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
                      action={
                        offerPublicData ? (
                          <Link
                            className={buttonVariants({ variant: "outline" })}
                            search={{ kind: undefined, publicData: "include" }}
                            to="/data"
                          >
                            Include public data
                          </Link>
                        ) : undefined
                      }
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
                    Resources you open will appear here.
                  </p>
                ) : (
                  <ResourceList>
                    {recentlyViewed.map((item) => (
                      <HomeResourceLink
                        item={{
                          identifier: item.identifier,
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
                <ResourceCreationLink
                  label="Create project"
                  render={<Link to="/projects/new" />}
                  size="sm"
                  variant="outline"
                />
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
              <CardViewAllLink
                render={<Link search={{ cursor: undefined }} to="/projects" />}
              />
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
                    trailing={
                      <LabeledTimestamp
                        label="Last activity"
                        presentation="activity"
                        value={project.last_activity_at}
                      />
                    }
                  />
                ))}
              </ResourceList>
            ) : null}
          </HomeOwnershipCard>

          <HomeOwnershipCard
            emptyAction={
              account?.capabilities.can_register_instrument ? (
                <ResourceCreationLink
                  label="Register instrument"
                  render={<Link to="/instruments/new" />}
                  size="sm"
                  variant="outline"
                />
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
              <CardViewAllLink
                render={
                  <Link
                    search={{
                      affiliation: "owner",
                      cursor: undefined,
                      status: undefined,
                    }}
                    to="/instruments"
                  />
                }
              />
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
                    trailing={
                      <LabeledTimestamp
                        label="Last activity"
                        presentation="activity"
                        value={instrument.last_activity_at}
                      />
                    }
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
  identifier?: string | null
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
  const data = item.kind === "sample" || item.kind === "dataset"
  return (
    <ResourceListItem>
      <ResourceListItemContent className="select-text" layout="responsive">
        <ResourceIdentity
          className="w-full flex-1"
          instrumentId={
            item.kind === "instrument" && item.identifier !== name
              ? item.identifier
              : null
          }
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
          projectId={
            data
              ? item.projectId
              : item.kind === "project" && item.identifier !== name
                ? item.identifier
                : null
          }
        />
        {item.timestamp ? (
          <LabeledTimestamp
            label={item.timestamp.label}
            value={item.timestamp.value}
          />
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
          {pending ? <ResourceListPending label={label} /> : null}
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
  trailing,
}: {
  identifier?: string | null
  kind: "instrument" | "project"
  mfid: string
  name: string
  trailing?: React.ReactNode
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
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
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
