import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { CollectionToolbar } from "@/components/crucible/collection-browser"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import {
  ResourcePreviewContext,
  resourcePreviewSearchSchema,
  useResourcePreviewNavigation,
} from "@/components/crucible/resource-preview-navigation"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { buttonVariants } from "@/components/ui/button"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { projectSummaryQueryOptions } from "@/data/crucible/projects.queries"
import {
  deletionRequestPageLimit,
  deletionRequestsInfiniteQueryOptions,
} from "@/data/crucible/deletion-requests.queries"
import { DeletionRequestQueue } from "@/features/deletion-requests/deletion-request-queue"
import { ResourceInspector } from "@/features/resource-inspector/resource-inspector"
import type { WorkspaceDeletionRequestSort } from "@/data/crucible/workspace-source"

const deletionRequestSearchSchema = z
  .object({
    direction: z.enum(["asc", "desc"]).optional().catch(undefined),
    projectMfid: z.string().trim().min(1).max(255).optional().catch(undefined),
    sort: z
      .enum([
        "project_id",
        "request_time",
        "requester_name",
        "resource_name",
        "status",
      ])
      .optional()
      .catch(undefined),
    view: z.enum(["reviewable", "submitted"]).optional().catch(undefined),
  })
  .merge(resourcePreviewSearchSchema)

const views = [
  { label: "Submitted by you", value: "submitted" },
  { label: "Needs review", value: "reviewable" },
] as const

export const Route = createFileRoute("/_app/deletion-requests")({
  head: () => ({ meta: [{ title: "Deletion requests | Crucible Hub" }] }),
  validateSearch: deletionRequestSearchSchema,
  loaderDeps: ({ search }) => ({
    direction: search.direction,
    projectMfid: search.projectMfid,
    sort: search.sort ?? "request_time",
    view: search.view ?? "submitted",
  }),
  loader: async ({ context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const options = deletionRequestsInfiniteQueryOptions(source.scope, {
      direction:
        deps.direction ?? defaultDeletionRequestDirection(deps.view, deps.sort),
      limit: deletionRequestPageLimit,
      projectMfid: deps.projectMfid,
      scope: deps.view,
      sort: deps.sort,
      status: deps.view === "reviewable" ? "pending" : undefined,
    })
    void context.queryClient.prefetchInfiniteQuery(options)
  },
  component: DeletionRequestsPage,
})

function DeletionRequestsPage() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const view = search.view ?? "submitted"
  const sort = search.sort ?? "request_time"
  const direction =
    search.direction ?? defaultDeletionRequestDirection(view, sort)
  const projectResult = useQuery({
    ...projectSummaryQueryOptions(scope, search.projectMfid ?? "unavailable"),
    enabled: Boolean(search.projectMfid),
  })
  const project = projectResult.data
  const projectName =
    project?.title?.trim() || project?.project_id || search.projectMfid
  const navigation = useResourcePreviewNavigation({
    kind: "deletion-requests",
    preview: search.preview,
  })

  return (
    <ResourcePreviewContext.Provider value={navigation}>
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
                  from="/deletion-requests"
                  search={(current) => ({
                    ...current,
                    projectMfid: undefined,
                  })}
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
                  search: (current) => ({
                    ...current,
                    direction: undefined,
                    preview: undefined,
                    sort: undefined,
                    view: nextView,
                  }),
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
          bulkReview={view === "reviewable"}
          emptyTitle={
            view === "reviewable"
              ? "No requests need review"
              : "No submitted requests"
          }
          filters={{
            direction,
            limit: deletionRequestPageLimit,
            projectMfid: search.projectMfid,
            scope: view,
            sort,
            status: view === "reviewable" ? "pending" : undefined,
          }}
          onSortChange={(nextSort, nextDirection) => {
            void navigate({
              replace: true,
              search: (current) => ({
                ...current,
                direction: nextDirection,
                preview: undefined,
                sort: nextSort === "request_time" ? undefined : nextSort,
              }),
              to: "/deletion-requests",
            })
          }}
          paginate
          scope={scope}
        />
      </PageLayout>
      <ResourceInspector navigation={navigation} />
    </ResourcePreviewContext.Provider>
  )
}

function defaultDeletionRequestDirection(
  view: "reviewable" | "submitted",
  sort: WorkspaceDeletionRequestSort
) {
  if (sort !== "request_time") return "asc" as const
  return view === "reviewable" ? ("asc" as const) : ("desc" as const)
}
