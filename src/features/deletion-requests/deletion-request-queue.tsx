import { useEffect, useState } from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { CollectionPagination } from "@/components/crucible/collection-pagination"
import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
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
import { Checkbox } from "@/components/ui/checkbox"
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
  WorkspaceDeletionRequestSort,
} from "@/data/crucible/workspace-source"
import { cn } from "@/lib/utils"

const pendingRows = ["first", "second", "third"] as const

export function DeletionRequestQueue({
  account,
  action,
  bulkReview = false,
  emptyTitle,
  filters,
  onSortChange,
  paginate = false,
  scope,
  title,
}: {
  account: WorkspaceAccount
  action?: React.ReactNode
  bulkReview?: boolean
  emptyTitle: string
  filters: Omit<WorkspaceDeletionRequestFilters, "cursor">
  onSortChange?: (
    sort: WorkspaceDeletionRequestSort,
    direction: "asc" | "desc"
  ) => void
  paginate?: boolean
  scope: IdentityScope
  title?: string
}) {
  const options = deletionRequestsInfiniteQueryOptions(scope, filters)
  const result = useInfiniteQuery(options)
  const [selected, setSelected] = useState<WorkspaceDeletionRequest>()
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<number>>(
    () => new Set()
  )
  const pages = result.data?.pages ?? []
  const items = pages.flatMap((page) => page.items)
  const total = pages.at(0)?.total ?? null

  useEffect(() => {
    setSelectedRequestIds(new Set())
  }, [
    filters.direction,
    filters.projectMfid,
    filters.scope,
    filters.sort,
    filters.status,
    scope[1],
    scope[2],
    scope[3],
  ])

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
          <DeletionRequestPending
            bulkReview={bulkReview}
            direction={filters.direction}
            onSortChange={onSortChange}
            requestTimePreferredDirection={
              filters.status === "pending" ? "asc" : "desc"
            }
            showProject={!filters.projectMfid}
            sort={filters.sort}
          />
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
            <BulkReviewController
              items={bulkReview ? items : []}
              onSelectionChange={setSelectedRequestIds}
              scope={scope}
              selectedRequestIds={selectedRequestIds}
            >
              {(bulkReviewActions) => (
                <DeletionRequestTable
                  account={account}
                  bulkReview={bulkReview}
                  bulkReviewActions={bulkReviewActions}
                  direction={filters.direction}
                  items={items}
                  onSortChange={onSortChange}
                  onOpen={setSelected}
                  requestTimePreferredDirection={
                    filters.status === "pending" ? "asc" : "desc"
                  }
                  onSelectionChange={setSelectedRequestIds}
                  selectedRequestIds={selectedRequestIds}
                  showProject={!filters.projectMfid}
                  sort={filters.sort}
                />
              )}
            </BulkReviewController>
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

function DeletionRequestPending({
  bulkReview,
  direction,
  onSortChange,
  requestTimePreferredDirection,
  showProject,
  sort,
}: {
  bulkReview: boolean
  direction: "asc" | "desc"
  onSortChange?: (
    sort: WorkspaceDeletionRequestSort,
    direction: "asc" | "desc"
  ) => void
  requestTimePreferredDirection: "asc" | "desc"
  showProject: boolean
  sort: WorkspaceDeletionRequestSort
}) {
  return (
    <CardContent
      aria-label="Loading deletion requests"
      className="px-0"
      role="status"
    >
      {bulkReview ? (
        <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <Checkbox
            aria-label="Select all loaded reviewable requests"
            disabled
          />
          <span className="text-label">Select all loaded</span>
        </div>
      ) : null}
      <Table
        className={cn(
          "deletion-request-table table-fixed",
          bulkReview && "has-selection"
        )}
      >
        <DeletionRequestColgroup
          bulkReview={bulkReview}
          showProject={showProject}
        />
        <DeletionRequestTableHeader
          bulkReview={bulkReview}
          direction={direction}
          onSortChange={onSortChange}
          requestTimePreferredDirection={requestTimePreferredDirection}
          showProject={showProject}
          sort={sort}
        />
        <TableBody>
          {pendingRows.map((row) => (
            <TableRow key={row}>
              {bulkReview ? (
                <TableCell className="deletion-request-select text-center">
                  <Skeleton className="mx-auto size-4 rounded-sm" />
                </TableCell>
              ) : null}
              <TableCell className="deletion-request-resource">
                <div className="flex min-w-0 items-center gap-2">
                  <Skeleton className="size-5 shrink-0 rounded-sm" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              </TableCell>
              {showProject ? (
                <TableCell
                  className="deletion-request-project"
                  data-label="Project"
                >
                  <Skeleton className="h-4 w-3/4" />
                </TableCell>
              ) : null}
              <TableCell
                className="deletion-request-requester"
                data-label="Requested by"
              >
                <Skeleton className="h-4 w-3/4" />
              </TableCell>
              <TableCell
                className="deletion-request-date"
                data-label="Requested"
              >
                <Skeleton className="h-4 w-4/5" />
              </TableCell>
              <TableCell
                className="deletion-request-status"
                data-label="Status"
              >
                <Skeleton className="h-6 w-16 rounded-full" />
              </TableCell>
              <TableCell className="deletion-request-action text-center">
                <Skeleton className="mx-auto h-7 w-16 rounded-lg" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  )
}

function DeletionRequestColgroup({
  bulkReview,
  showProject,
}: {
  bulkReview: boolean
  showProject: boolean
}) {
  return (
    <colgroup>
      {bulkReview ? <col className="w-deletion-selection-column" /> : null}
      <col
        className={
          bulkReview
            ? showProject
              ? "w-deletion-resource-column-with-project-and-selection"
              : "w-deletion-resource-column-with-selection"
            : showProject
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
  )
}

function DeletionRequestTableHeader({
  bulkReview,
  bulkReviewActions,
  direction,
  onSelectAll,
  onSortChange,
  requestTimePreferredDirection,
  selectableCount = 0,
  selectedCount = 0,
  showProject,
  sort,
}: {
  bulkReview: boolean
  bulkReviewActions?: React.ReactNode
  direction: "asc" | "desc"
  onSelectAll?: (checked: boolean) => void
  onSortChange?: (
    sort: WorkspaceDeletionRequestSort,
    direction: "asc" | "desc"
  ) => void
  requestTimePreferredDirection: "asc" | "desc"
  selectableCount?: number
  selectedCount?: number
  showProject: boolean
  sort: WorkspaceDeletionRequestSort
}) {
  return (
    <TableHeader>
      <TableRow>
        {bulkReview ? (
          <TableHead className="text-center">
            <Checkbox
              aria-label="Select all loaded reviewable requests"
              className="mx-auto"
              checked={selectableCount > 0 && selectedCount === selectableCount}
              disabled={!onSelectAll || selectableCount === 0}
              indeterminate={
                selectedCount > 0 && selectedCount < selectableCount
              }
              onCheckedChange={(checked) => onSelectAll?.(checked)}
            />
          </TableHead>
        ) : null}
        {bulkReviewActions ? (
          <TableHead colSpan={showProject ? 6 : 5}>
            {bulkReviewActions}
          </TableHead>
        ) : onSortChange ? (
          <SortableTableHead
            active={sort === "resource_name"}
            direction={direction}
            field="resource_name"
            label="Resource"
            onChange={onSortChange}
            preferredDirection="asc"
          />
        ) : (
          <TableHead>Resource</TableHead>
        )}
        {!bulkReviewActions && showProject ? (
          onSortChange ? (
            <SortableTableHead
              active={sort === "project_id"}
              direction={direction}
              field="project_id"
              label="Project"
              onChange={onSortChange}
              preferredDirection="asc"
            />
          ) : (
            <TableHead>Project</TableHead>
          )
        ) : null}
        {!bulkReviewActions ? (
          onSortChange ? (
            <SortableTableHead
              active={sort === "requester_name"}
              direction={direction}
              field="requester_name"
              label="Requested by"
              onChange={onSortChange}
              preferredDirection="asc"
            />
          ) : (
            <TableHead>Requested by</TableHead>
          )
        ) : null}
        {!bulkReviewActions ? (
          onSortChange ? (
            <SortableTableHead
              active={sort === "request_time"}
              direction={direction}
              field="request_time"
              label="Requested"
              onChange={onSortChange}
              preferredDirection={requestTimePreferredDirection}
            />
          ) : (
            <TableHead>Requested</TableHead>
          )
        ) : null}
        {!bulkReviewActions ? (
          onSortChange ? (
            <SortableTableHead
              active={sort === "status"}
              direction={direction}
              field="status"
              label="Status"
              onChange={onSortChange}
              preferredDirection="asc"
            />
          ) : (
            <TableHead>Status</TableHead>
          )
        ) : null}
        {!bulkReviewActions ? (
          <TableHead className="text-center">
            <span className="sr-only">Actions</span>
          </TableHead>
        ) : null}
      </TableRow>
    </TableHeader>
  )
}

function BulkReviewController({
  children,
  items,
  onSelectionChange,
  scope,
  selectedRequestIds,
}: {
  children: (actions?: React.ReactNode) => React.ReactNode
  items: readonly WorkspaceDeletionRequest[]
  onSelectionChange: React.Dispatch<React.SetStateAction<Set<number>>>
  scope: IdentityScope
  selectedRequestIds: ReadonlySet<number>
}) {
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState<WorkspaceDeletionReviewDecision>()
  const [reviewError, setReviewError] = useState<string>()
  const [reviewerNotes, setReviewerNotes] = useState("")
  const requests = items.filter(
    (request) =>
      selectedRequestIds.has(request.id) && isReviewableDeletionRequest(request)
  )
  const mutation = useMutation({
    mutationFn: async ({
      decision: nextDecision,
      requests: nextRequests,
    }: {
      decision: WorkspaceDeletionReviewDecision
      requests: readonly WorkspaceDeletionRequest[]
    }) => {
      const results = await Promise.allSettled(
        nextRequests.map(async (request) =>
          unwrapHubResult(
            await reviewWorkspaceDeletionRequestById({
              data: {
                decision: nextDecision,
                requestId: request.id,
                reviewerNotes: reviewerNotes.trim() || undefined,
                scenario: fixtureScenarioFromScope(scope),
              },
            })
          )
        )
      )
      return results.reduce<{
        failed: Array<{
          error: unknown
          request: WorkspaceDeletionRequest
        }>
        reviewed: WorkspaceDeletionRequest[]
      }>(
        (outcome, result, index) => {
          const request = nextRequests[index]
          if (result.status === "fulfilled") outcome.reviewed.push(result.value)
          else outcome.failed.push({ error: result.reason, request })
          return outcome
        },
        { failed: [], reviewed: [] }
      )
    },
  })

  async function reviewSelected() {
    if (!decision || requests.length === 0) return
    setReviewError(undefined)
    try {
      const outcome = await mutation.mutateAsync({ decision, requests })
      const failedIds = new Set(outcome.failed.map(({ request }) => request.id))
      onSelectionChange(failedIds)
      if (outcome.reviewed.length > 0) {
        await Promise.allSettled([
          invalidateDeletionRequestMutationQueries(
            queryClient,
            scope,
            outcome.reviewed.map((request) => request.resource_id)
          ),
        ])
      }
      if (outcome.failed.length > 0) {
        const fallback = `${outcome.failed.length} request${outcome.failed.length === 1 ? "" : "s"} could not be reviewed.`
        const reason = hubErrorMessage(outcome.failed[0]?.error, fallback)
        setReviewError(
          outcome.reviewed.length > 0
            ? `${outcome.reviewed.length} completed. ${reason}`
            : reason
        )
        return
      }
      notifySuccess(
        decision === "approved"
          ? `${outcome.reviewed.length} deletion request${outcome.reviewed.length === 1 ? "" : "s"} approved`
          : `${outcome.reviewed.length} deletion request${outcome.reviewed.length === 1 ? "" : "s"} rejected`
      )
      setReviewerNotes("")
      setDecision(undefined)
    } catch (error) {
      setReviewError(
        hubErrorMessage(error, "The selected requests could not be reviewed.")
      )
    }
  }

  return (
    <>
      {children(
        requests.length > 0 ? (
          <BulkReviewActions
            count={requests.length}
            onApprove={() => {
              mutation.reset()
              setReviewError(undefined)
              setReviewerNotes("")
              setDecision("approved")
            }}
            onReject={() => {
              mutation.reset()
              setReviewError(undefined)
              setReviewerNotes("")
              setDecision("rejected")
            }}
          />
        ) : undefined
      )}
      <ConfirmationAlertDialog
        confirmLabel={
          decision === "approved" ? "Approve deletion" : "Reject requests"
        }
        description={`Review ${requests.length} selected request${requests.length === 1 ? "" : "s"} individually. Completed reviews remain applied if another request fails.`}
        error={reviewError}
        onConfirm={() => void reviewSelected()}
        onOpenChange={(open) => {
          if (!open) {
            mutation.reset()
            setReviewError(undefined)
            setReviewerNotes("")
            setDecision(undefined)
          }
        }}
        open={Boolean(decision)}
        pending={mutation.isPending}
        pendingLabel={decision === "approved" ? "Approving" : "Rejecting"}
        title={
          decision === "approved"
            ? "Approve selected deletion requests?"
            : "Reject selected deletion requests?"
        }
        variant={decision === "approved" ? "destructive" : "default"}
      >
        <Field>
          <FieldLabel htmlFor="bulk-deletion-review-notes" optional>
            Reviewer comment
          </FieldLabel>
          <Textarea
            disabled={mutation.isPending}
            id="bulk-deletion-review-notes"
            maxLength={2_000}
            onChange={(event) => setReviewerNotes(event.target.value)}
            value={reviewerNotes}
          />
        </Field>
      </ConfirmationAlertDialog>
    </>
  )
}

function BulkReviewActions({
  count,
  onApprove,
  onReject,
}: {
  count: number
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="mr-auto truncate text-label">{count} selected</span>
      <Button onClick={onReject} size="sm" variant="outline">
        Reject
      </Button>
      <Button onClick={onApprove} size="sm" variant="destructive">
        Approve deletion
      </Button>
    </div>
  )
}

function isReviewableDeletionRequest(request: WorkspaceDeletionRequest) {
  return request.status === "pending" && request.capabilities.can_review
}

function DeletionRequestTable({
  account,
  bulkReview,
  bulkReviewActions,
  direction,
  items,
  onSortChange,
  onOpen,
  onSelectionChange,
  requestTimePreferredDirection,
  selectedRequestIds,
  showProject,
  sort,
}: {
  account: WorkspaceAccount
  bulkReview: boolean
  bulkReviewActions?: React.ReactNode
  direction: "asc" | "desc"
  items: readonly WorkspaceDeletionRequest[]
  onSortChange?: (
    sort: WorkspaceDeletionRequestSort,
    direction: "asc" | "desc"
  ) => void
  onOpen: (request: WorkspaceDeletionRequest) => void
  onSelectionChange: React.Dispatch<React.SetStateAction<Set<number>>>
  requestTimePreferredDirection: "asc" | "desc"
  selectedRequestIds: ReadonlySet<number>
  showProject: boolean
  sort: WorkspaceDeletionRequestSort
}) {
  const selectableRequests = bulkReview
    ? items.filter(isReviewableDeletionRequest)
    : []
  const selectedCount = selectableRequests.filter((request) =>
    selectedRequestIds.has(request.id)
  ).length

  function selectAll(checked: boolean) {
    onSelectionChange((current) => {
      const next = new Set(current)
      for (const request of selectableRequests) {
        if (checked) next.add(request.id)
        else next.delete(request.id)
      }
      return next
    })
  }

  return (
    <>
      {bulkReview ? (
        <div className="flex min-h-11 items-center gap-2 border-b px-3 py-2 md:hidden">
          <Checkbox
            aria-label="Select all loaded reviewable requests"
            checked={
              selectableRequests.length > 0 &&
              selectedCount === selectableRequests.length
            }
            disabled={selectableRequests.length === 0}
            indeterminate={
              selectedCount > 0 && selectedCount < selectableRequests.length
            }
            onCheckedChange={selectAll}
          />
          {bulkReviewActions ?? (
            <span className="text-label">Select all loaded</span>
          )}
        </div>
      ) : null}
      <Table
        aria-label="Deletion requests"
        className={cn(
          "deletion-request-table table-fixed",
          bulkReview && "has-selection"
        )}
      >
        <DeletionRequestColgroup
          bulkReview={bulkReview}
          showProject={showProject}
        />
        <DeletionRequestTableHeader
          bulkReviewActions={bulkReviewActions}
          bulkReview={bulkReview}
          direction={direction}
          onSelectAll={selectAll}
          onSortChange={onSortChange}
          requestTimePreferredDirection={requestTimePreferredDirection}
          selectedCount={selectedCount}
          selectableCount={selectableRequests.length}
          showProject={showProject}
          sort={sort}
        />
        <TableBody>
          {items.map((request) => {
            const requester =
              request.requester_id === account.unique_id
                ? account
                : request.requester
            return (
              <TableRow
                data-state={
                  selectedRequestIds.has(request.id) ? "selected" : undefined
                }
                key={request.id}
              >
                {bulkReview ? (
                  <TableCell className="deletion-request-select text-center">
                    <Checkbox
                      aria-label={`Select deletion request for ${request.resource_name?.trim() || "untitled resource"}`}
                      checked={selectedRequestIds.has(request.id)}
                      className="mx-auto"
                      disabled={!isReviewableDeletionRequest(request)}
                      onCheckedChange={(checked) => {
                        onSelectionChange((current) => {
                          const next = new Set(current)
                          if (checked) next.add(request.id)
                          else next.delete(request.id)
                          return next
                        })
                      }}
                    />
                  </TableCell>
                ) : null}
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
    </>
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
  if (type === "sample" || type === "project" || type === "instrument")
    return type
  return "dataset"
}
