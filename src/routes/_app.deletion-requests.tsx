import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { CollectionPageNavigation } from "@/components/crucible/collection-page-navigation"
import { CollectionToolbar } from "@/components/crucible/collection-browser"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { buttonVariants } from "@/components/ui/button"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { projectSummaryQueryOptions } from "@/data/crucible/projects.queries"
import {
  deletionRequestPageLimit,
  deletionRequestsQueryOptions,
} from "@/data/crucible/deletion-requests.queries"
import type { WorkspaceDeletionRequestPage } from "@/data/crucible/workspace-source"
import { DeletionRequestQueue } from "@/features/deletion-requests/deletion-request-queue"

const deletionRequestSearchSchema = z.object({
  offset: z.coerce.number().int().min(0).optional().catch(undefined),
  projectMfid: z.string().trim().min(1).max(255).optional().catch(undefined),
  view: z.enum(["reviewable", "submitted"]).optional().catch(undefined),
})

const views = [
  { label: "Submitted by you", value: "submitted" },
  { label: "Needs review", value: "reviewable" },
] as const

export const Route = createFileRoute("/_app/deletion-requests")({
  head: () => ({ meta: [{ title: "Deletion requests | Crucible Hub" }] }),
  validateSearch: deletionRequestSearchSchema,
  loaderDeps: ({ search }) => ({
    offset: search.offset ?? 0,
    projectMfid: search.projectMfid,
    view: search.view ?? "submitted",
  }),
  loader: async ({ context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const options = deletionRequestsQueryOptions(source.scope, {
      limit: deletionRequestPageLimit,
      offset: deps.offset,
      projectMfid: deps.projectMfid,
      scope: deps.view,
      status: deps.view === "reviewable" ? "pending" : undefined,
    })
    void context.queryClient.prefetchQuery(options)
  },
  component: DeletionRequestsPage,
})

function DeletionRequestsPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const view = search.view ?? "submitted"
  const offset = search.offset ?? 0
  const projectResult = useQuery({
    ...projectSummaryQueryOptions(scope, search.projectMfid ?? "unavailable"),
    enabled: Boolean(search.projectMfid),
  })
  const project = projectResult.data
  const projectName =
    project?.title?.trim() || project?.project_id || search.projectMfid

  return (
    <PageLayout>
      <PageHeader title="Deletion requests" />
      <CollectionToolbar
        actions={
          search.projectMfid && projectName ? (
            <>
              <ResourceIdentityLink
                context={
                  project?.title?.trim() ? project.project_id : undefined
                }
                kind="project"
                mfid={search.projectMfid}
                name={projectName}
              >
                <span className="inline-flex max-w-72 min-w-0 items-center gap-2 text-body hover:underline">
                  <ResourceTypeIcon className="shrink-0" type="project" />
                  <span className="truncate">{projectName}</span>
                </span>
              </ResourceIdentityLink>
              <Link
                aria-label="Clear project filter"
                className={buttonVariants({ size: "sm", variant: "ghost" })}
                search={{ offset: undefined, projectMfid: undefined, view }}
                to="/deletion-requests"
              >
                Clear
              </Link>
            </>
          ) : undefined
        }
        primary={
          <SegmentedControl
            ariaLabel="Deletion request view"
            onValueChange={(nextView) => {
              void navigate({
                replace: true,
                search: {
                  offset: undefined,
                  projectMfid: search.projectMfid,
                  view: nextView,
                },
                to: "/deletion-requests",
              })
            }}
            options={views}
            value={view}
          />
        }
      />
      <DeletionRequestQueue
        account={account}
        emptyTitle={
          view === "reviewable"
            ? "No requests need review"
            : "No submitted requests"
        }
        filters={{
          limit: deletionRequestPageLimit,
          offset,
          projectMfid: search.projectMfid,
          scope: view,
          status: view === "reviewable" ? "pending" : undefined,
        }}
        renderFooter={(page) => (
          <DeletionRequestPagination
            page={page}
            projectMfid={search.projectMfid}
            view={view}
          />
        )}
        scope={scope}
      />
    </PageLayout>
  )
}

function DeletionRequestPagination({
  page,
  projectMfid,
  view,
}: {
  page: WorkspaceDeletionRequestPage
  projectMfid?: string
  view: "reviewable" | "submitted"
}) {
  const hasPrevious = page.offset > 0
  const hasNext =
    page.total === null
      ? page.items.length === page.limit
      : page.offset + page.items.length < page.total
  return (
    <CollectionPageNavigation
      label="Deletion-request pages"
      previous={
        hasPrevious ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            search={{
              offset: Math.max(0, page.offset - page.limit) || undefined,
              projectMfid,
              view,
            }}
            to="/deletion-requests"
          >
            Previous
          </Link>
        ) : undefined
      }
      next={
        hasNext ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            search={{
              offset: page.offset + page.items.length,
              projectMfid,
              view,
            }}
            to="/deletion-requests"
          >
            Next
          </Link>
        ) : undefined
      }
    />
  )
}
