import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { PanelState } from "@/components/crucible/collection-state"
import { ContentBoundary } from "@/components/crucible/content-layout"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { joinRequestsQueryOptions } from "@/data/crucible/join-requests.queries"
import type { JoinRequestFilters } from "@/data/crucible/join-requests.queries"
import type { WorkspaceJoinRequest } from "@/data/crucible/workspace-source"
import {
  JoinRequestReviewTable,
  SubmittedJoinRequestsTable,
} from "@/features/join-requests/join-request-review"

export const Route = createFileRoute("/_app/join-requests")({
  head: () => ({ meta: [{ title: "Join requests | Crucible Hub" }] }),
  component: JoinRequestsPage,
})

function JoinRequestsPage() {
  return (
    <PageLayout>
      <PageHeader title="Join requests" />
      <ContentBoundary className="flex flex-col gap-page-section">
        <JoinRequestSection
          emptyTitle="No requests need your review"
          filters={{ scope: "reviewable", status: "pending" }}
          render={(requests) => (
            <JoinRequestReviewTable requests={requests} showProject />
          )}
          title="Needs your review"
        />
        <JoinRequestSection
          emptyTitle="You haven't asked to join a project"
          filters={{ scope: "submitted" }}
          render={(requests) => (
            <SubmittedJoinRequestsTable requests={requests} />
          )}
          title="Your requests"
        />
      </ContentBoundary>
    </PageLayout>
  )
}

function JoinRequestSection({
  emptyTitle,
  filters,
  render,
  title,
}: {
  emptyTitle: string
  filters: JoinRequestFilters
  render: (requests: readonly WorkspaceJoinRequest[]) => React.ReactNode
  title: string
}) {
  const scope = useWorkspaceScope()
  const result = useQuery(joinRequestsQueryOptions(scope, filters))
  const requests = result.data?.items ?? []
  return (
    <Card aria-busy={result.isFetching}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {result.data ? (
          <CardAction>
            <Badge variant="outline">
              {result.data.total ?? requests.length}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={requests.length ? "px-0" : undefined}>
        {result.isPending ? (
          <PanelState title="Loading requests" />
        ) : result.isError && requests.length === 0 ? (
          <PanelState
            retry={() => void result.refetch()}
            role="alert"
            title="Requests could not be loaded"
          />
        ) : requests.length === 0 ? (
          <PanelState title={emptyTitle} />
        ) : (
          render(requests)
        )}
      </CardContent>
    </Card>
  )
}
