import { useQueries } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"

import { CollectionRowsPending } from "@/components/crucible/collection-state"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
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
import { cn } from "@/lib/utils"

const homeProjectLimit = 5
const homeRecentResourceLimit = 5

export const Route = createFileRoute("/_app/")({
  loader: async ({ context, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    void context.queryClient.prefetchQuery(
      projectsQueryOptions(source.scope, { limit: homeProjectLimit, offset: 0 })
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
        projectsQueryOptions(scope, { limit: homeProjectLimit, offset: 0 }),
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

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Research workspace"
        title={`Welcome back, ${account?.first_name ?? "researcher"}`}
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-5">
        <section
          aria-labelledby="recent-research-title"
          className="min-w-0 xl:col-span-3"
        >
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
                <HomePanelState
                  description="Projects and navigation remain available."
                  retry={() => {
                    void sampleResult.refetch()
                    void datasetResult.refetch()
                  }}
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
                  <HomePanelState
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
                <ul className="flex min-w-0 flex-col" role="list">
                  {recentResources.map((item) => (
                    <RecentResourceLink
                      item={item}
                      key={`${item.kind}:${item.resource.unique_id}`}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <div className="min-w-0 xl:col-span-2">
          <section aria-labelledby="home-projects-title">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 id="home-projects-title">Your projects</h2>
                </CardTitle>
                <CardAction>
                  <Link
                    className={buttonVariants({ variant: "ghost" })}
                    search={{ offset: undefined }}
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
                    <HomePanelState
                      description="Recent data and navigation remain available."
                      retry={() => void projectResult.refetch()}
                      title="Projects could not be loaded"
                    />
                  )}
                {!projectResult.isPending &&
                  !projectResult.isError &&
                  projects.length === 0 && (
                    <HomePanelState
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
      </div>
    </PageLayout>
  )
}

function RecentResourceLink({ item }: { item: HomeRecentResource }) {
  const resource = item.resource
  const context = recentResourceContext(item)

  return (
    <li className="min-w-0 border-b last:border-b-0">
      <Link
        className="flex min-w-0 items-start gap-3 rounded-lg p-3 hover:bg-muted/50"
        params={
          item.kind === "sample"
            ? { sampleMfid: resource.unique_id }
            : { datasetMfid: resource.unique_id }
        }
        to={
          item.kind === "sample"
            ? "/samples/$sampleMfid"
            : "/datasets/$datasetMfid"
        }
      >
        <ResourceTypeIcon
          className={cn(
            "mt-0.5 shrink-0",
            item.kind === "dataset"
              ? "text-(--resource-dataset)"
              : "text-(--resource-sample)"
          )}
          type={item.kind}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-label">{recentResourceName(item)}</p>
          {context && (
            <p className="mt-1 truncate text-body text-muted-foreground">
              {context}
            </p>
          )}
        </div>
        {resource.creation_time && (
          <time
            className="hidden shrink-0 text-supporting text-muted-foreground sm:block"
            dateTime={resource.creation_time}
          >
            {formatDate(resource.creation_time)}
          </time>
        )}
      </Link>
    </li>
  )
}

function ProjectLink({ project }: { project: WorkspaceProject }) {
  const details = "organization" in project ? project : null

  return (
    <li>
      <Link
        className="flex min-w-0 items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
        params={{ projectMfid: project.unique_id }}
        to="/projects/$projectMfid"
      >
        <ResourceTypeIcon
          className="mt-0.5 shrink-0 text-(--resource-project)"
          type="project"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="min-w-0 truncate text-label">
              {project.title ?? project.project_id}
            </p>
            {details?.status && (
              <Badge variant="outline">{details.status}</Badge>
            )}
          </div>
          <p className="mt-1 truncate text-body text-muted-foreground">
            {details?.organization ?? project.project_id}
          </p>
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

function HomePanelState({
  description,
  retry,
  title,
}: {
  description: string
  retry?: () => void
  title: string
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {retry && (
        <Button onClick={retry} size="sm" variant="outline">
          Try again
        </Button>
      )}
    </Empty>
  )
}

function recentResourceName(item: HomeRecentResource) {
  return item.kind === "dataset"
    ? item.resource.dataset_name
    : item.resource.sample_name
}

function recentResourceContext(item: HomeRecentResource) {
  const project = item.resource.project
  const projectName = project?.title ?? project?.project_id
  const scientificType =
    item.kind === "dataset"
      ? item.resource.measurement
      : item.resource.sample_type
  return [scientificType, projectName].filter(Boolean).join(" · ")
}
