import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { DeletionRequestStatusBadge } from "@/components/crucible/deletion-request-status-badge"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidText } from "@/components/crucible/mfid-text"
import { notifySuccess } from "@/components/crucible/notifications"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { invalidateDeletionRequestMutationQueries } from "@/data/crucible/cache-effects"
import { reviewWorkspaceDeletionRequestById } from "@/data/crucible/deletion-requests.functions"
import { deletionRequestsQueryOptions } from "@/data/crucible/deletion-requests.queries"
import type {
  WorkspaceDeletionRequestFilters,
  WorkspaceDeletionReviewDecision,
} from "@/data/crucible/deletion-requests.server"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { personQueryOptions } from "@/data/crucible/people.queries"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceAccount,
  WorkspaceDeletionRequest,
  WorkspaceDeletionRequestPage,
} from "@/data/crucible/workspace-source"

const pendingRows = ["first", "second", "third"] as const

export function DeletionRequestQueue({
  account,
  action,
  emptyTitle,
  filters,
  renderFooter,
  scope,
  title,
}: {
  account: WorkspaceAccount
  action?: React.ReactNode
  emptyTitle: string
  filters: WorkspaceDeletionRequestFilters
  renderFooter?: (page: WorkspaceDeletionRequestPage) => React.ReactNode
  scope: IdentityScope
  title?: string
}) {
  const options = deletionRequestsQueryOptions(scope, filters)
  const result = useQuery(options)
  const [selected, setSelected] = useState<WorkspaceDeletionRequest>()

  return (
    <>
      <Card aria-busy={result.isFetching}>
        {title || action ? (
          <CardHeader actionLayout="inline">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {action ? <CardAction>{action}</CardAction> : null}
          </CardHeader>
        ) : null}
        {result.isPending ? (
          <DeletionRequestPending />
        ) : result.isError && !result.data ? (
          <CardContent>
            <Empty className="min-h-40 border" role="alert">
              <EmptyHeader>
                <EmptyTitle>Deletion requests could not be loaded</EmptyTitle>
              </EmptyHeader>
              <Button onClick={() => void result.refetch()} variant="outline">
                Retry
              </Button>
            </Empty>
          </CardContent>
        ) : result.data.items.length === 0 ? (
          <CardContent>
            <Empty className="min-h-32">
              <EmptyHeader>
                <EmptyTitle>{emptyTitle}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </CardContent>
        ) : (
          <CardContent className="px-0">
            {result.isError ? (
              <p className="px-4 pb-3 text-body text-destructive" role="alert">
                The list could not be refreshed. Showing the last loaded
                requests.
              </p>
            ) : null}
            <DeletionRequestTable
              account={account}
              items={result.data.items}
              onOpen={setSelected}
            />
          </CardContent>
        )}
      </Card>
      {result.data && renderFooter ? renderFooter(result.data) : null}
      <DeletionRequestDialog
        account={account}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined)
        }}
        request={selected}
        scope={scope}
      />
    </>
  )
}

function DeletionRequestPending() {
  return (
    <CardContent aria-label="Loading deletion requests" role="status">
      <div className="flex flex-col gap-4">
        {pendingRows.map((row) => (
          <div className="flex items-center gap-3" key={row}>
            <Skeleton className="size-8 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-8 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </CardContent>
  )
}

function DeletionRequestTable({
  account,
  items,
  onOpen,
}: {
  account: WorkspaceAccount
  items: readonly WorkspaceDeletionRequest[]
  onOpen: (request: WorkspaceDeletionRequest) => void
}) {
  return (
    <Table aria-label="Deletion requests" className="deletion-request-table">
      <TableHeader>
        <TableRow>
          <TableHead>Resource</TableHead>
          <TableHead>Requested by</TableHead>
          <TableHead>Requested</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-center">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((request) => (
          <TableRow key={request.id}>
            <TableCell className="deletion-request-resource">
              <ResourceIdentity
                kind={resourceKind(request.resource_type)}
                mfid={request.resource_id}
                name={request.resource_name?.trim() || "Untitled resource"}
                presentation="collection"
                projectId={request.project_id}
              />
            </TableCell>
            <TableCell
              className="deletion-request-requester"
              data-label="Requested by"
            >
              {request.requester_id === account.unique_id ? (
                <PersonLink
                  nameStyle="abbreviated"
                  person={account}
                  presentation="inline"
                />
              ) : (
                <Link
                  className="inline-flex min-w-0 items-center gap-1.5 hover:underline"
                  params={{ personId: request.requester_id }}
                  to="/people/$personId"
                >
                  <PrincipalTypeIcon type="user" />
                  <MfidText className="truncate" value={request.requester_id} />
                </Link>
              )}
            </TableCell>
            <TableCell className="deletion-request-date" data-label="Requested">
              <LocalDateTime value={request.request_time} />
            </TableCell>
            <TableCell className="deletion-request-status" data-label="Status">
              <DeletionRequestStatusBadge status={request.status} />
            </TableCell>
            <TableCell className="deletion-request-action text-center">
              <Button
                onClick={() => onOpen(request)}
                size="sm"
                variant={
                  request.capabilities.can_review ? "default" : "outline"
                }
              >
                {request.capabilities.can_review ? "Review" : "View"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DeletionRequestDialog({
  account,
  onOpenChange,
  request,
  scope,
}: {
  account: WorkspaceAccount
  onOpenChange: (open: boolean) => void
  request?: WorkspaceDeletionRequest
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [reviewerNotes, setReviewerNotes] = useState("")
  const personResult = useQuery({
    ...personQueryOptions(scope, request?.requester_id ?? "unavailable"),
    enabled: Boolean(request && request.requester_id !== account.unique_id),
  })
  const reviewerResult = useQuery({
    ...personQueryOptions(scope, request?.reviewer_id ?? "unavailable"),
    enabled: Boolean(
      request?.reviewer_id && request.reviewer_id !== account.unique_id
    ),
  })
  const mutation = useMutation({
    mutationFn: async (decision: WorkspaceDeletionReviewDecision) => {
      if (!request) throw new Error("No deletion request is selected.")
      return unwrapHubResult(
        await reviewWorkspaceDeletionRequestById({
          data: {
            decision,
            requestId: request.id,
            reviewerNotes: reviewerNotes.trim() || undefined,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      )
    },
  })

  async function review(decision: WorkspaceDeletionReviewDecision) {
    if (!request) return
    try {
      const reviewed = await mutation.mutateAsync(decision)
      await invalidateDeletionRequestMutationQueries(
        queryClient,
        scope,
        reviewed.resource_id
      )
      notifySuccess(
        decision === "approved"
          ? "Deletion request approved"
          : "Deletion request rejected"
      )
      setReviewerNotes("")
      onOpenChange(false)
    } catch {
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.deletionRequestQueries(scope),
      })
      return
    }
  }

  const requester =
    request?.requester_id === account.unique_id ? account : personResult.data
  const reviewer =
    request?.reviewer_id === account.unique_id ? account : reviewerResult.data

  return (
    <Dialog
      onOpenChange={(open) => {
        if (mutation.isPending) return
        if (!open) {
          setReviewerNotes("")
          mutation.reset()
        }
        onOpenChange(open)
      }}
      open={Boolean(request)}
    >
      <DialogContent showCloseButton={!mutation.isPending}>
        {request ? (
          <>
            <DialogHeader>
              <DialogTitle>Deletion request</DialogTitle>
            </DialogHeader>
            <ResourceIdentity
              kind={resourceKind(request.resource_type)}
              mfid={request.resource_id}
              name={request.resource_name?.trim() || "Untitled resource"}
              projectId={request.project_id}
            />
            <dl className="grid gap-4 text-body sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">
                  Requested by
                </dt>
                <dd className="mt-1 min-w-0">
                  {requester ? (
                    <PersonLink
                      person={requester}
                      presentation="avatar"
                      size="sm"
                    />
                  ) : (
                    <MfidText value={request.requester_id} />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-label text-muted-foreground">Requested</dt>
                <dd className="mt-1">
                  <LocalDateTime value={request.request_time} />
                </dd>
              </div>
              <div>
                <dt className="text-label text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <DeletionRequestStatusBadge status={request.status} />
                </dd>
              </div>
              {request.review_time ? (
                <div>
                  <dt className="text-label text-muted-foreground">Reviewed</dt>
                  <dd className="mt-1">
                    <LocalDateTime value={request.review_time} />
                  </dd>
                </div>
              ) : null}
              {request.reviewer_id ? (
                <div className="min-w-0">
                  <dt className="text-label text-muted-foreground">
                    Reviewed by
                  </dt>
                  <dd className="mt-1 min-w-0">
                    {reviewer ? (
                      <PersonLink
                        person={reviewer}
                        presentation="avatar"
                        size="sm"
                      />
                    ) : (
                      <MfidText value={request.reviewer_id} />
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div>
              <h3 className="text-label text-muted-foreground">Reason</h3>
              <p className="mt-1 text-body wrap-break-word">
                {request.reason?.trim() || "No reason provided."}
              </p>
            </div>
            {request.reviewer_notes ? (
              <div>
                <h3 className="text-label text-muted-foreground">
                  Reviewer notes
                </h3>
                <p className="mt-1 text-body wrap-break-word">
                  {request.reviewer_notes}
                </p>
              </div>
            ) : null}
            {request.capabilities.can_review ? (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="deletion-review-notes" optional>
                    Reviewer notes
                  </FieldLabel>
                  <Textarea
                    disabled={mutation.isPending}
                    id="deletion-review-notes"
                    maxLength={2_000}
                    onChange={(event) => setReviewerNotes(event.target.value)}
                    value={reviewerNotes}
                  />
                </Field>
              </FieldGroup>
            ) : null}
            {mutation.isError ? (
              <p className="text-body text-destructive" role="alert">
                {hubErrorMessage(
                  mutation.error,
                  "The deletion request could not be reviewed. Your notes are still here."
                )}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                disabled={mutation.isPending}
                onClick={() => {
                  setReviewerNotes("")
                  mutation.reset()
                  onOpenChange(false)
                }}
                type="button"
                variant="outline"
              >
                Close
              </Button>
              {request.capabilities.can_review ? (
                <>
                  <Button
                    disabled={mutation.isPending}
                    onClick={() => void review("rejected")}
                    type="button"
                    variant="outline"
                  >
                    {mutation.isPending && mutation.variables === "rejected"
                      ? "Rejecting deletion"
                      : "Reject deletion"}
                  </Button>
                  <Button
                    disabled={mutation.isPending}
                    onClick={() => void review("approved")}
                    type="button"
                    variant="destructive"
                  >
                    {mutation.isPending && mutation.variables === "approved"
                      ? "Approving deletion"
                      : "Approve deletion"}
                  </Button>
                </>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function resourceKind(type: string | null | undefined) {
  return type === "sample" ? "sample" : "dataset"
}
