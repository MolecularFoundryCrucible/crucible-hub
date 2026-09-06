import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"
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
import {
  useWorkspace,
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import {
  projectPageLimit,
  projectsQueryOptions,
} from "@/data/crucible/projects.queries"
import type { WorkspaceProjectPage } from "@/data/crucible/workspace-source"

const projectSearchSchema = z.object({
  offset: z.coerce.number().int().min(0).catch(0).optional(),
})

export const Route = createFileRoute("/_app/projects/")({
  validateSearch: projectSearchSchema,
  loaderDeps: ({ search }) => ({ offset: search.offset ?? 0 }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const options = projectsQueryOptions(source.scope, {
      limit: projectPageLimit,
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
  component: ProjectsPage,
})

function ProjectsPage() {
  const scope = useWorkspaceScope()
  const search = Route.useSearch()
  const offset = search.offset ?? 0
  const projectResult = useQuery(
    projectsQueryOptions(scope, { limit: projectPageLimit, offset })
  )

  return (
    <PageLayout>
      <PageHeader eyebrow="Projects" title="Your projects" />
      {projectResult.isPending ? (
        <CollectionCardGridPending label="projects" />
      ) : projectResult.isError && !projectResult.data ? (
        <>
          <CollectionLoadError
            label="Projects"
            retry={() => void projectResult.refetch()}
          />
          {offset > 0 ? (
            <nav className="flex justify-end" aria-label="Project pages">
              <Link
                className={buttonVariants({ variant: "outline" })}
                search={{
                  offset: Math.max(0, offset - projectPageLimit) || undefined,
                }}
                to="/projects"
              >
                Previous
              </Link>
            </nav>
          ) : null}
        </>
      ) : (
        <>
          {projectResult.isError ? (
            <CollectionUpdateError
              label="Projects"
              preserved
              retry={() => void projectResult.refetch()}
            />
          ) : null}
          <ProjectCollection
            offset={offset}
            projectPage={projectResult.data}
            updating={projectResult.isFetching}
          />
        </>
      )}
    </PageLayout>
  )
}

function ProjectCollection({
  offset,
  projectPage,
  updating,
}: {
  offset: number
  projectPage: WorkspaceProjectPage
  updating: boolean
}) {
  const workspace = useWorkspace()
  const mode = useWorkspaceMode()
  const previousOffset = Math.max(0, offset - projectPageLimit)
  const nextOffset = offset + projectPage.items.length
  const hasNext =
    projectPage.items.length === projectPageLimit &&
    (projectPage.total === null || nextOffset < projectPage.total)

  return (
    <>
      <CollectionUpdateStatus label="projects" updating={updating} />
      <section
        aria-busy={updating}
        className="grid gap-4 lg:grid-cols-2"
        aria-label="Project collection"
      >
        {projectPage.items.map((project) => {
          const complete = "status" in project
          const datasetCount =
            mode === "fixture"
              ? workspace.datasets.filter(
                  (dataset) => dataset.project_id === project.project_id
                ).length
              : null
          const sampleCount =
            mode === "fixture"
              ? workspace.samples.filter(
                  (sample) => sample.project_id === project.project_id
                ).length
              : null
          return (
            <Card key={project.unique_id}>
              <CardHeader>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <ResourceTypeIcon
                    className="text-(--resource-project)"
                    type="project"
                  />
                  <Badge variant={complete ? "secondary" : "outline"}>
                    {complete ? project.status : "Limited details"}
                  </Badge>
                </div>
                <CardTitle>{project.title}</CardTitle>
                <CardDescription>{project.project_id}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <dl className="grid grid-cols-3 gap-3 text-body">
                  <div>
                    <dt className="text-muted-foreground">Samples</dt>
                    <dd className="mt-1 text-label tabular-nums">
                      {sampleCount ?? "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Datasets</dt>
                    <dd className="mt-1 text-label tabular-nums">
                      {datasetCount ?? "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Updated</dt>
                    <dd className="mt-1 text-label">
                      {complete
                        ? formatDate(project.modification_time)
                        : "Unknown"}
                    </dd>
                  </div>
                </dl>
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  to="/projects/$projectMfid"
                  params={{ projectMfid: project.unique_id }}
                >
                  Open project
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </section>
      {!updating && (offset > 0 || hasNext) && (
        <nav
          className="flex items-center justify-end gap-2"
          aria-label="Project pages"
        >
          {offset > 0 && (
            <Link
              className={buttonVariants({ variant: "outline" })}
              search={{
                offset: previousOffset === 0 ? undefined : previousOffset,
              }}
              to="/projects"
            >
              Previous
            </Link>
          )}
          {hasNext && (
            <Link
              className={buttonVariants({ variant: "outline" })}
              search={{ offset: nextOffset }}
              to="/projects"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  )
}
