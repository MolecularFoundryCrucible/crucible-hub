import { useState } from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { CollectionPagination } from "@/components/crucible/collection-pagination"
import { DeletionRequestStatusBadge } from "@/components/crucible/deletion-request-status-badge"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidText } from "@/components/crucible/mfid-text"
import { notifySuccess } from "@/components/crucible/notifications"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import { ResourcePreviewLink } from "@/components/crucible/resource-preview-navigation"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
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
import { deletionRequestsInfiniteQueryOptions } from "@/data/crucible/deletion-requests.queries"
import type {
  WorkspaceDeletionRequestFilters,
  WorkspaceDeletionReviewDecision,
} from "@/data/crucible/deletion-requests.server"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceAccount,
  WorkspaceDeletionRequest,
} from "@/data/crucible/workspace-source"

const pendingRows = ["first", "second", "third"] as const

export function DeletionRequestQueue({
  account,
  action,
  emptyTitle,
  filters,
  onDirectionChange,
  paginate = false,
  scope,
  title,
}: {
  account: WorkspaceAccount
  action?: React.ReactNode
  emptyTitle: string
  filters: Omit<WorkspaceDeletionRequestFilters, "cursor">
  onDirectionChange?: (direction: "asc" | "desc") => void
  paginate?: boolean
  scope: IdentityScope
  title?: string
}) {
  const options = deletionRequestsInfiniteQueryOptions(scope, filters)
  const result = useInfiniteQuery(options)
  const [selected, setSelected] = useState<WorkspaceDeletionRequest>()
  const pages = result.data?.pages ?? []
  const items = pages.flatMap((page) => page.items)
  const total = pages.at(0)?.total ?? null

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
        ) : items.length === 0 ? (
          <CardContent>
            <Empty className="min-h-32">
              <EmptyHeader>
                <EmptyTitle>{emptyTitle}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </CardContent>
        ) : (
          <CardContent className="px-0">
            {result.isRefetchError ? (
              <p className="px-4 pb-3 text-body text-destructive" role="alert">
                The list could not be refreshed. Showing the last loaded
                requests.
              </p>
            ) : null}
            <DeletionRequestTable
              account={account}
              direction={filters.direction}
              items={items}
              onDirectionChange={onDirectionChange}
              onOpen={setSelected}
              showProject={!filters.projectMfid}
            />
          </CardContent>
        )}
      </Card>
      {paginate ? (
        <CollectionPagination
          disabled={result.isFetchingNextPage}
          hasNextPage={result.hasNextPage}
          isError={result.isFetchNextPageError}
          isLoading={result.isFetchingNextPage}
          label="deletion requests"
          loaded={items.length}
          onLoadMore={() => void result.fetchNextPage()}
          total={total}
        />
      ) : null}
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
  direction,
  items,
  onDirectionChange,
  onOpen,
  showProject,
}: {
  account: WorkspaceAccount
  direction: "asc" | "desc"
  items: readonly WorkspaceDeletionRequest[]
  onDirectionChange?: (direction: "asc" | "desc") => void
  onOpen: (request: WorkspaceDeletionRequest) => void
  showProject: boolean
}) {
  return (
    <Table
      aria-label="Deletion requests"
      className="deletion-request-table table-fixed"
    >
      <colgroup>
        <col
          className={
            showProject
              ? "w-deletion-resource-column-with-project"
              : "w-deletion-resource-column"
          }
        />
        {showProject ? <col className="w-deletion-project-column" /> : null}
        <col className="w-deletion-requester-column" />
        <col className="w-deletion-date-column" />
        <col className="w-deletion-status-column" />
        <col className="w-deletion-action-column" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>Resource</TableHead>
          {showProject ? <TableHead>Project</TableHead> : null}
          <TableHead>Requested by</TableHead>
          {onDirectionChange ? (
            <SortableTableHead
              active
              direction={direction}
              field="request_time"
              label="Requested"
              onChange={(_, nextDirection) => onDirectionChange(nextDirection)}
            />
          ) : (
            <TableHead>Requested</TableHead>
          )}
          <TableHead>Status</TableHead>
          <TableHead className="text-center">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((request) => {
          const requester =
            request.requester_id === account.unique_id
              ? account
              : request.requester
          return (
            <TableRow key={request.id}>
              <TableCell className="deletion-request-resource">
                <DeletionRequestResource request={request} />
              </TableCell>
              {showProject ? (
                <TableCell
                  className="deletion-request-project"
                  data-label="Project"
                >
                  <DeletionRequestProject request={request} />
                </TableCell>
              ) : null}
              <TableCell
                className="deletion-request-requester"
                data-label="Requested by"
              >
                {requester ? (
                  <PersonLink
                    nameStyle="abbreviated"
                    person={requester}
                    presentation="inline"
                  />
                ) : (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <PrincipalTypeIcon type="user" />
                    <MfidText
                      className="truncate"
                      presentation="supporting"
                      value={request.requester_id}
                    />
                  </span>
                )}
              </TableCell>
              <TableCell
                className="deletion-request-date"
                data-label="Requested"
              >
                <LocalDateTime value={request.request_time} />
              </TableCell>
              <TableCell
                className="deletion-request-status"
                data-label="Status"
              >
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
          )
        })}
      </TableBody>
    </Table>
  )
}

function DeletionRequestResource({
  request,
}: {
  request: WorkspaceDeletionRequest
}) {
  const kind = resourceKind(request.resource_type)
  const name = request.resource_name?.trim() || "Untitled resource"
  return (
    <ResourcePreviewLink
      aria-label={`Preview ${name}`}
      className="group/resource block min-w-0"
      mfid={request.resource_id}
      resourceKind={kind}
      resourceName={name}
    >
      <ResourceIdentity
        interactive
        kind={kind}
        name={name}
        presentation="collection"
      />
    </ResourcePreviewLink>
  )
}

function DeletionRequestProject({
  request,
}: {
  request: WorkspaceDeletionRequest
}) {
  const projectId = request.project_id?.trim()
  if (!projectId)
    return <span className="text-muted-foreground">Not assigned</span>
  if (!request.project_mfid)
    return <span className="truncate">{projectId}</span>
  return (
    <ResourceIdentityLink
      kind="project"
      mfid={request.project_mfid}
      name={projectId}
      showTypeIcon={false}
    >
      <span className="block truncate hover:underline">{projectId}</span>
    </ResourceIdentityLink>
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
    request?.requester_id === account.unique_id ? account : request?.requester
  const reviewer =
    request?.reviewer_id === account.unique_id ? account : request?.reviewer

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
