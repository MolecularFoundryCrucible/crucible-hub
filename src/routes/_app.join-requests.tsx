import { useIsFetching, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  CollectionSection,
  CollectionToolbar,
} from "@/components/crucible/collection-browser"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { RefreshButton } from "@/components/crucible/refresh-button"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { JoinRequestQueue } from "@/features/join-requests/join-request-review"

const views = [
  { label: "Your requests", value: "submitted" },
  { label: "Needs review", value: "reviewable" },
] as const

export const Route = createFileRoute("/_app/join-requests")({
  head: () => ({ meta: [{ title: "Join requests | Crucible Hub" }] }),
  validateSearch: z.object({
    view: z.enum(["reviewable", "submitted"]).optional().catch(undefined),
  }),
  component: JoinRequestsPage,
})

function JoinRequestsPage() {
  const scope = useWorkspaceScope()
  const queryClient = useQueryClient()
  const navigate = Route.useNavigate()
  const view = Route.useSearch().view ?? "submitted"
  const queryKey = crucibleKeys.joinRequestQueries(scope)
  const refreshing = useIsFetching({ queryKey }) > 0

  return (
    <PageLayout>
      <PageHeader divider={false} title="Join requests" />
      <CollectionSection>
        <CollectionToolbar
          actions={
            <RefreshButton
              label="Refresh join requests"
              onClick={() =>
                void queryClient.refetchQueries({ queryKey, type: "active" })
              }
              refreshing={refreshing}
            />
          }
          primary={
            <SegmentedControl
              ariaLabel="Join request view"
              onValueChange={(nextView) =>
                void navigate({
                  replace: true,
                  search: { view: nextView },
                })
              }
              options={views}
              value={view}
            />
          }
        />
        {view === "reviewable" ? (
          <JoinRequestQueue
            emptyTitle="No requests need review"
            filters={{ scope: "reviewable", status: "pending" }}
            key="reviewable"
          />
        ) : (
          <JoinRequestQueue
            emptyTitle="You haven't asked to join a project"
            filters={{ scope: "submitted" }}
            key="submitted"
          />
        )}
      </CollectionSection>
    </PageLayout>
  )
}
