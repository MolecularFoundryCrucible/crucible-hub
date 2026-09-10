import { useQueries } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"

import {
  CollectionRowsPending,
  PanelState,
} from "@/components/crucible/collection-state"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
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
import { projectsQueryOptions } from "@/data/crucible/projects.queries"
import type { WorkspaceProject } from "@/data/crucible/workspace-source"
import { selectRecentResources } from "@/features/home/home-data"
import type { HomeRecentResource } from "@/features/home/home-data"
import { formatDate } from "@/lib/format"
import { useRecentlyViewed } from "@/features/recently-viewed/recently-viewed"
import type { RecentlyViewedResource } from "@/features/recently-viewed/recently-viewed"

const homeProjectLimit = 5
const homeRecentResourceLimit = 5

export const Route = createFileRoute("/_app/")({
  loader: async ({ context, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    void context.queryClient.prefetchQuery(
      projectsQueryOptions(source.scope, { limit: homeProjectLimit })
    )
    void context.queryClient.prefetchQuery(
      samplesQueryOptions(source.scope, { limit: homeRecentResourceLimit })
    )
    void context.queryClient.prefetchQuery(
      datasetsQueryOptions(source.scope, { limit: homeRecentResourceLimit })
    )
  },
  component: HomePage,
})

function HomePage() {
  const scope = useWorkspaceScope()
  const [accountResult, projectResult, sampleResult, datasetResult] =
    useQueries({
      queries: [
        accountQueryOptions(scope),
        projectsQueryOptions(scope, { limit: homeProjectLimit }),
        samplesQueryOptions(scope, { limit: homeRecentResourceLimit }),
        datasetsQueryOptions(scope, { limit: homeRecentResourceLimit }),
      ],
    })
  const account = accountResult.data
  const projects = projectResult.data?.items ?? []
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
              <CardHeader>
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

        <section
          aria-labelledby="home-projects-title"
          className="min-w-0 xl:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle>
                <h2 id="home-projects-title">Your projects</h2>
              </CardTitle>
              <CardAction>
                <Link
                  className={buttonVariants({ variant: "ghost" })}
                  search={{ affiliation: undefined, cursor: undefined }}
                  to="/projects"
                >
                  View all
                  <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {projectResult.isPending && (
                <CollectionRowsPending label="your projects" />
              )}
              {!projectResult.isPending &&
                projectResult.isError &&
                !projectResult.data && (
                  <PanelState
                    description="Recent data and navigation remain available."
                    retry={() => void projectResult.refetch()}
                    role="alert"
                    title="Projects could not be loaded"
                  />
                )}
              {!projectResult.isPending &&
                !projectResult.isError &&
                projects.length === 0 && (
                  <PanelState
                    description="Projects shared with your account will appear here."
                    title="No projects are available yet"
                  />
                )}
              {projects.length > 0 && (
                <ul className="flex min-w-0 flex-col gap-2" role="list">
                  {projects.map((project) => (
                    <ProjectLink key={project.unique_id} project={project} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
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

function ProjectLink({ project }: { project: WorkspaceProject }) {
  const details = "organization" in project ? project : null

  return (
    <li>
      <Link
        className="group/resource flex min-w-0 items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
        params={{ projectMfid: project.unique_id }}
        search={{ preview: undefined }}
        state={{}}
        to="/projects/$projectMfid"
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <ResourceIdentity
              className="flex-1"
              context={details?.organization ?? project.project_id}
              interactive
              kind="project"
              name={project.title ?? project.project_id}
              presentation="collection"
            />
            {details?.status && (
              <Badge variant="outline">{details.status}</Badge>
            )}
          </div>
          {details?.modification_time && (
            <time
              className="mt-1 block text-supporting text-muted-foreground"
              dateTime={details.modification_time}
            >
              Updated {formatDate(details.modification_time)}
            </time>
          )}
        </div>
      </Link>
    </li>
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
