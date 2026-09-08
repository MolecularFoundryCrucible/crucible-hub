import { useQuery } from "@tanstack/react-query"
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
  head: () => ({ meta: [{ title: "Projects | Crucible Hub" }] }),
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
  pendingComponent: ProjectsRoutePending,
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
      <ProjectsPageHeader />
      {projectResult.isPending ? (
        <CollectionTablePending label="projects" />
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

function ProjectsRoutePending() {
  return (
    <PageLayout>
      <ProjectsPageHeader />
      <CollectionTablePending label="projects" />
    </PageLayout>
  )
}

function ProjectsPageHeader() {
  return (
    <PageHeader
      actions={
        <Link
          className={buttonVariants({ variant: "outline" })}
          to="/projects/new"
        >
          <CreateResourceIcon data-icon="inline-start" />
          Create project
        </Link>
      }
      eyebrow="Projects"
      title="Your projects"
    />
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
  const previousOffset = Math.max(0, offset - projectPageLimit)
  const nextOffset = offset + projectPage.items.length
  const hasNext =
    projectPage.items.length === projectPageLimit &&
    (projectPage.total === null || nextOffset < projectPage.total)

  return (
    <>
      <CollectionUpdateStatus label="projects" updating={updating} />
      {projectPage.items.length > 0 ? (
        <Card aria-busy={updating}>
          <CardContent className="px-0">
            <Table
              aria-label="Project collection"
              className="resource-directory-table resource-directory-project-table table-fixed"
            >
              <colgroup>
                <col className="resource-directory-name-column" />
                <col className="resource-directory-person-column" />
                <col className="resource-directory-date-column" />
                <col className="resource-directory-action-column" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-center">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectPage.items.map((project) => {
                  const complete = "status" in project
                  const title = project.title?.trim()
                  const name = title || project.project_id
                  return (
                    <TableRow key={project.unique_id}>
                      <ResourceDirectoryNameCell
                        identifier={title ? project.project_id : null}
                        kind="project"
                        mfid={project.unique_id}
                        name={name}
                      />
                      <TableCell
                        className="resource-directory-person"
                        data-label="Lead"
                      >
                        {complete && project.lead ? (
                          <PersonLink person={project.lead} />
                        ) : (
                          <span aria-label="Not available">-</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="resource-directory-date"
                        data-label="Updated"
                      >
                        {complete && project.modification_time
                          ? formatDate(project.modification_time)
                          : "-"}
                      </TableCell>
                      <TableCell className="resource-directory-action text-center">
                        <ResourceFullPageLink
                          kind="project"
                          mfid={project.unique_id}
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
        <Empty className="min-h-state border">
          <EmptyHeader>
            <EmptyTitle>No projects found</EmptyTitle>
            <EmptyDescription>
              No projects are available to this account.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
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
