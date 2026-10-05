import { useMemo } from "react"
import {
  useInfiniteQuery,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { resourceDisplayName } from "@/lib/resource-name"

import { CollectionAffiliationFilter } from "@/components/crucible/collection-affiliation-filter"
import { CollectionToolbar } from "@/components/crucible/collection-browser"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
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
  projectPageLimit,
  projectsCursorQueryOptions,
} from "@/data/crucible/projects.queries"
import {
  collectionAffiliationSchema,
  collectionCursorSchema,
} from "@/data/crucible/collection-query"
import {
  cursorPageTotal,
  flattenCursorPages,
} from "@/data/crucible/cursor-pages"
import type { WorkspaceProject } from "@/data/crucible/workspace-source"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"

const projectSearchSchema = z.object({
  affiliation: collectionAffiliationSchema.optional().catch(undefined),
  cursor: collectionCursorSchema,
})

export const Route = createFileRoute("/_app/projects/")({
  head: () => ({ meta: [{ title: "Projects | Crucible Hub" }] }),
  validateSearch: projectSearchSchema,
  loaderDeps: ({ search }) => ({
    affiliation: search.affiliation,
    cursor: search.cursor,
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const options = projectsCursorQueryOptions(source.scope, {
      includeTotal: true,
      limit: projectPageLimit,
      ...deps,
    })
    const request = prefetchInfiniteQueryWithReadableCache(
      context.queryClient,
      options
    )
    if (cause !== "stay" && request) await request
  },
  pendingComponent: ProjectsRoutePending,
  staleTime: Infinity,
  component: ProjectsPage,
})

function ProjectsPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const search = Route.useSearch()
  const projectResult = useInfiniteQuery(
    projectsCursorQueryOptions(scope, {
      affiliation: search.affiliation,
      cursor: search.cursor,
      includeTotal: true,
      limit: projectPageLimit,
    })
  )
  const projects = useMemo(
    () => flattenCursorPages(projectResult.data?.pages),
    [projectResult.data]
  )
  const total = cursorPageTotal(projectResult.data?.pages)
  const updating = projectResult.isFetching && !projectResult.isFetchingNextPage

  return (
    <PageLayout>
      <ProjectsPageHeader canCreate={account.capabilities.can_create_project} />
      <ProjectDirectoryFilters affiliation={search.affiliation} />
      {projectResult.isPending ? (
        <CollectionTablePending label="projects" presentation="projects" />
      ) : projectResult.isError && !projectResult.data ? (
        <>
          <CollectionLoadError
            label="Projects"
            retry={() => void projectResult.refetch()}
          />
        </>
      ) : (
        <>
          {projectResult.isError && !projectResult.isFetchNextPageError ? (
            <CollectionUpdateError
              label="Projects"
              preserved
              retry={() => void projectResult.refetch()}
            />
          ) : null}
          <ProjectCollection
            affiliation={search.affiliation}
            hasNextPage={Boolean(projectResult.hasNextPage)}
            isLoadingMore={projectResult.isFetchingNextPage}
            loadMoreError={projectResult.isFetchNextPageError}
            onLoadMore={() => void projectResult.fetchNextPage()}
            projects={projects}
            total={total}
            updating={updating}
          />
        </>
      )}
    </PageLayout>
  )
}

function ProjectsRoutePending() {
  const scope = useWorkspaceScope()
  const { data: account } = useQuery(accountQueryOptions(scope))
  return (
    <PageLayout>
      <ProjectsPageHeader
        canCreate={account?.capabilities.can_create_project === true}
      />
      <ProjectDirectoryFilters affiliation={Route.useSearch().affiliation} />
      <CollectionTablePending label="projects" presentation="projects" />
    </PageLayout>
  )
}

function ProjectsPageHeader({ canCreate }: { canCreate: boolean }) {
  return (
    <PageHeader
      actions={
        canCreate ? (
          <Link className={buttonVariants()} to="/projects/new">
            <CreateResourceIcon data-icon="inline-start" />
            Create project
          </Link>
        ) : null
      }
      title="Your projects"
    />
  )
}

function ProjectDirectoryFilters({ affiliation }: { affiliation?: "owner" }) {
  const navigate = Route.useNavigate()
  return (
    <CollectionToolbar
      primary={
        <CollectionAffiliationFilter
          onChange={(nextAffiliation) =>
            void navigate({
              search: { affiliation: nextAffiliation, cursor: undefined },
              state: {},
              to: "/projects",
            })
          }
          ownerLabel="Led by me"
          value={affiliation}
        />
      }
    />
  )
}

function ProjectCollection({
  affiliation,
  hasNextPage,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  projects,
  total,
  updating,
}: {
  affiliation?: "owner"
  hasNextPage: boolean
  isLoadingMore: boolean
  loadMoreError: boolean
  onLoadMore: () => void
  projects: readonly WorkspaceProject[]
  total: number | null
  updating: boolean
}) {
  return (
    <>
      <CollectionUpdateStatus label="projects" updating={updating} />
      {projects.length > 0 ? (
        <Card aria-busy={updating}>
          <CardContent className="px-0">
            <Table
              aria-label="Project collection"
              className="resource-directory-table resource-directory-project-table table-fixed"
            >
              <colgroup>
                <col className="resource-directory-name-column" />
                <col className="resource-directory-person-column" />
                <col className="resource-directory-date-column hidden xl:table-column" />
                <col className="resource-directory-date-column" />
                <col className="resource-directory-action-column" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Lead</TableHead>
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
                {projects.map((project) => {
                  const complete = "status" in project
                  const title = project.title?.trim()
                  const name = resourceDisplayName("project", project.title, {
                    identifier: project.project_id,
                    mfid: project.unique_id,
                  })
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
                          <PersonLink
                            nameStyle="abbreviated"
                            person={project.lead}
                            presentation="collection"
                          />
                        ) : (
                          <span aria-label="Not available">-</span>
                        )}
                      </TableCell>
                      <ResourceCreatedCell
                        className="hidden xl:table-cell"
                        value={complete ? project.creation_time : undefined}
                      />
                      <ResourceUpdatedCell
                        value={complete ? project.modification_time : undefined}
                      />
                      <ResourceOpenCell
                        kind="project"
                        mfid={project.unique_id}
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
        <Empty className="min-h-state border">
          <EmptyHeader>
            <EmptyTitle>No projects found</EmptyTitle>
            <EmptyDescription>
              {affiliation
                ? "You do not lead any projects."
                : "No projects are available to this account."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {projects.length ? (
        <CollectionPagination
          disabled={updating}
          hasNextPage={hasNextPage}
          isError={loadMoreError}
          isLoading={isLoadingMore}
          label="projects"
          loaded={projects.length}
          onLoadMore={onLoadMore}
          total={total}
        />
      ) : null}
    </>
  )
}
