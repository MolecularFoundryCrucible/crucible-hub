import { useState } from "react"
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link, Navigate, createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  CollectionLoadError,
  CollectionTablePending,
  CollectionUpdateError,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { CollectionPageNavigation } from "@/components/crucible/collection-page-navigation"
import { EditResourceIcon as ReviewIcon } from "@/components/crucible/icons"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidText } from "@/components/crucible/mfid-text"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import {
  useAdministrationScope,
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { canOpenJoinRequestAdministration } from "@/data/crucible/administration"
import {
  joinRequestAdminPageLimit,
  joinRequestsListQueryOptions,
} from "@/data/crucible/join-requests.queries"
import {
  crucibleKeys,
  identityScopeWithPrivilegeMode,
} from "@/data/crucible/query-keys"
import type {
  WorkspaceAccount,
  WorkspaceJoinRequest,
  WorkspaceJoinRequestPage,
} from "@/data/crucible/workspace-source"
import { JoinRequestReviewDialog } from "@/features/admin/join-request-review-dialog"

const joinRequestSearchSchema = z.object({
  offset: z.coerce.number().int().min(0).optional().catch(undefined),
  status: z
    .enum(["all", "pending", "approved", "rejected"])
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute("/_app/admin/join-requests")({
  head: () => ({ meta: [{ title: "Join requests | Crucible Hub" }] }),
  validateSearch: joinRequestSearchSchema,
  loaderDeps: ({ search }) => ({
    offset: search.offset ?? 0,
    status: search.status === "all" ? undefined : search.status,
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const account = context.queryClient.getQueryData<WorkspaceAccount>(
      crucibleKeys.accountProfile(source.scope)
    )
    if (!account || !canOpenJoinRequestAdministration(account)) return
    const administrationScope = identityScopeWithPrivilegeMode(
      source.scope,
      "elevated"
    )
    const options = joinRequestsListQueryOptions(administrationScope, {
      limit: joinRequestAdminPageLimit,
      ...deps,
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
  pendingComponent: JoinRequestsPending,
  component: JoinRequestsAdminPage,
})

function statusVariant(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
      return "success"
    case "rejected":
      return "destructive"
    case "pending":
    default:
      return "warning"
  }
}

function JoinRequestsAdminPage() {
  const scope = useWorkspaceScope()
  const administrationScope = useAdministrationScope()
  const mode = useWorkspaceMode()
  const queryClient = useQueryClient()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const offset = search.offset ?? 0
  const activeStatus = search.status ?? "all"
  const filterStatus = activeStatus === "all" ? undefined : activeStatus

  const options = joinRequestsListQueryOptions(administrationScope, {
    limit: joinRequestAdminPageLimit,
    offset,
    status: filterStatus,
  })
  const result = useQuery({
    ...options,
    enabled: canOpenJoinRequestAdministration(account),
  })

  const [reviewingRequest, setReviewingRequest] =
    useState<WorkspaceJoinRequest | null>(null)

  if (!canOpenJoinRequestAdministration(account)) {
    return <Navigate replace to="/" />
  }

  function handleReviewed(updated: WorkspaceJoinRequest) {
    if (mode === "api") {
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.joinRequestAdminQueries(administrationScope),
      })
      return
    }
    queryClient.setQueryData<WorkspaceJoinRequestPage>(
      options.queryKey,
      (current) =>
        current
          ? {
              ...current,
              items: current.items.map((r) =>
                r.id === updated.id ? updated : r
              ),
            }
          : current
    )
  }

  const page = result.data
  const hasPrevious = page ? page.offset > 0 : false
  const hasNext = page
    ? page.total === null
      ? page.items.length === page.limit
      : page.offset + page.items.length < page.total
    : false

  return (
    <PageLayout>
      <PageHeader
        description="Review and resolve platform-wide access group join requests."
        title="Join requests"
      />
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((s) => (
          <Button
            key={s}
            onClick={() => {
              void navigate({
                search: {
                  offset: undefined,
                  status: s === "all" ? undefined : s,
                },
                state: {},
                to: "/admin/join-requests",
              })
            }}
            size="sm"
            variant={activeStatus === s ? "default" : "outline"}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {result.isPending ? (
        <CollectionTablePending
          label="join requests"
          presentation="resources"
        />
      ) : result.isError && !result.data ? (
        <CollectionLoadError
          label="Join requests"
          retry={() => void result.refetch()}
        />
      ) : (
        <>
          {result.isError ? (
            <CollectionUpdateError
              label="Join requests"
              preserved
              retry={() => void result.refetch()}
            />
          ) : null}
          <CollectionUpdateStatus
            label="join requests"
            updating={result.isFetching}
          />
          {page && page.items.length > 0 ? (
            <Card aria-busy={result.isFetching}>
              <CardContent className="px-0">
                <Table aria-label="Join requests">
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Access group</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-center">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.items.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-mono text-muted-foreground">
                          #{req.id}
                        </TableCell>
                        <TableCell>
                          <Link
                            className="hover:underline"
                            params={{ groupName: req.group_name }}
                            to="/admin/access-groups/$groupName"
                          >
                            {req.group_name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <MfidText value={req.requester_id} />
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-body text-muted-foreground">
                          {req.reason || "None"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(req.status)}>
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-body text-muted-foreground">
                          {req.request_time ? (
                            <LocalDateTime value={req.request_time} />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {req.status === "pending" ? (
                            <Button
                              aria-label={`Review request #${req.id}`}
                              onClick={() => setReviewingRequest(req)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <ReviewIcon data-icon="inline-start" />
                              Review
                            </Button>
                          ) : (
                            <span className="text-supporting text-muted-foreground">
                              Resolved
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Empty className="min-h-state border">
              <EmptyHeader>
                <EmptyTitle>No join requests found</EmptyTitle>
                <EmptyDescription>
                  There are no join requests matching the selected filter.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <CollectionPageNavigation
            label="Join request pages"
            previous={
              hasPrevious ? (
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  search={{
                    offset:
                      Math.max(0, offset - joinRequestAdminPageLimit) ||
                      undefined,
                    status: search.status,
                  }}
                  to="/admin/join-requests"
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
                    offset: offset + joinRequestAdminPageLimit,
                    status: search.status,
                  }}
                  to="/admin/join-requests"
                >
                  Next
                </Link>
              ) : undefined
            }
          />
        </>
      )}

      <JoinRequestReviewDialog
        onOpenChange={(open) => {
          if (!open) setReviewingRequest(null)
        }}
        onReviewed={handleReviewed}
        open={Boolean(reviewingRequest)}
        request={reviewingRequest}
        scope={administrationScope}
      />
    </PageLayout>
  )
}

function JoinRequestsPending() {
  return (
    <PageLayout>
      <PageHeader title="Join requests" />
      <CollectionTablePending label="join requests" presentation="resources" />
    </PageLayout>
  )
}
