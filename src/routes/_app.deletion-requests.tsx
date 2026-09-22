import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { CollectionPageNavigation } from "@/components/crucible/collection-page-navigation"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { MfidText } from "@/components/crucible/mfid-text"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { buttonVariants } from "@/components/ui/button"
import { accountQueryOptions } from "@/data/crucible/account.queries"
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

  return (
    <PageLayout>
      <PageHeader
        actions={
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
        title="Deletion requests"
      />
      {search.projectMfid ? (
        <div className="flex flex-wrap items-center gap-2 text-body">
          <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
            <ResourceTypeIcon type="project" />
            Project
            <MfidText className="truncate" value={search.projectMfid} />
          </span>
          <Link
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            search={{ offset: undefined, projectMfid: undefined, view }}
            to="/deletion-requests"
          >
            Clear project
          </Link>
        </div>
      ) : null}
      <DeletionRequestQueue
        account={account}
        emptyDescription={
          view === "reviewable"
            ? "There are no pending requests you can currently review."
            : "Requests you submit will appear here."
        }
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
        title={view === "reviewable" ? "Needs review" : "Submitted by you"}
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
