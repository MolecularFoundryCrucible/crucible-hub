import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import type { ReactNode } from "react"

import { CardViewAllLink } from "@/components/crucible/card-view-all-link"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { notifySuccess } from "@/components/crucible/notifications"
import { PendingRegion } from "@/components/crucible/pending-region"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { SelectableTextLink } from "@/components/crucible/selectable-text-link"
import { StatusBadge } from "@/components/crucible/status-badge"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import {
  reviewJoinRequestFn,
  withdrawJoinRequestFn,
} from "@/data/crucible/join-requests.functions"
import { joinRequestsInfiniteQueryOptions } from "@/data/crucible/join-requests.queries"
import type { JoinRequestFilters } from "@/data/crucible/join-requests.queries"
import {
  crucibleKeys,
  privilegeModeFromScope,
} from "@/data/crucible/query-keys"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceJoinRequest,
  WorkspaceJoinRequestRole,
} from "@/data/crucible/workspace-source"

import { joinRequestError } from "./join-request-messages"

const roles: { label: string; value: WorkspaceJoinRequestRole }[] = [
  { label: "Viewer", value: "viewer" },
  { label: "Contributor", value: "contributor" },
  { label: "Editor", value: "editor" },
  { label: "Admin", value: "admin" },
]

function projectName(request: WorkspaceJoinRequest) {
  return (
    request.project?.title?.trim() ||
    request.project?.project_id ||
    request.project_mfid
  )
}

function requesterName(request: WorkspaceJoinRequest) {
  const person = request.requester
  if (!person) return request.requester_id
  return (
    [person.first_name, person.last_name].filter(Boolean).join(" ") ||
    person.username ||
    request.requester_id
  )
}

function useJoinRequestActions() {
  const scope = useWorkspaceScope()
  const queryClient = useQueryClient()
  const scenario = fixtureScenarioFromScope(scope)
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: crucibleKeys.joinRequestQueries(scope),
      }),
      queryClient.invalidateQueries({
        queryKey: crucibleKeys.projectQueries(scope),
      }),
    ])
  const review = useMutation({
    mutationFn: async (input: {
      notes: string
      requestId: number
      role?: WorkspaceJoinRequestRole
      status: "approved" | "rejected"
    }) =>
      unwrapHubResult(
        await reviewJoinRequestFn({
          data: {
            privilegeMode: privilegeModeFromScope(scope),
            requestId: input.requestId,
            reviewerNotes: input.notes.trim() || null,
            role: input.role,
            scenario,
            status: input.status,
          },
        })
      ),
    onSuccess: refresh,
  })
  const withdraw = useMutation({
    mutationFn: async (requestId: number) =>
      unwrapHubResult(
        await withdrawJoinRequestFn({ data: { requestId, scenario } })
      ),
    onSuccess: refresh,
  })
  return { review, withdraw }
}

function reviewError(error: unknown, fallback: string) {
  if (
    error instanceof HubApiClientError &&
    error.details.kind === "forbidden"
  ) {
    return "You can't grant that role here. Choose one no higher than your own."
  }
  return joinRequestError(error, fallback)
}

function ReviewDialog({
  onClose,
  request,
}: {
  onClose: () => void
  request: WorkspaceJoinRequest | undefined
}) {
  const { review } = useJoinRequestActions()
  const [role, setRole] = useState<WorkspaceJoinRequestRole>("contributor")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string>()

  function decide(status: "approved" | "rejected") {
    if (!request || review.isPending) return
    setError(undefined)
    review.mutate(
      {
        notes,
        requestId: request.id,
        role: status === "approved" ? role : undefined,
        status,
      },
      {
        onError: (cause) =>
          setError(
            reviewError(
              cause,
              status === "approved"
                ? "The request could not be approved."
                : "The request could not be rejected."
            )
          ),
        onSuccess: () => {
          notifySuccess(
            status === "approved" ? "Request approved" : "Request rejected"
          )
          onClose()
        },
      }
    )
  }

  return (
    <ConfirmationDialog
      confirmLabel="Approve"
      description={
        request
          ? `${requesterName(request)} asked to join ${projectName(request)}.`
          : ""
      }
      error={error}
      onConfirm={() => decide("approved")}
      onOpenChange={(next) => {
        if (review.isPending || next) return
        onClose()
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return
        setRole("contributor")
        setNotes("")
        setError(undefined)
      }}
      open={request !== undefined}
      pending={review.isPending}
      pendingLabel="Saving review"
      secondaryAction={{ label: "Reject", onClick: () => decide("rejected") }}
      title="Review request"
    >
      {request ? (
        <FieldGroup>
          {request.reason ? (
            <p className="text-body break-words whitespace-pre-line">
              {request.reason}
            </p>
          ) : null}
          <Field>
            <FieldLabel htmlFor={`join-role-${request.id}`}>
              Role if approved
            </FieldLabel>
            <NativeSelect
              className="w-full"
              id={`join-role-${request.id}`}
              onChange={(event) =>
                setRole(event.target.value as WorkspaceJoinRequestRole)
              }
              value={role}
            >
              {roles.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`join-notes-${request.id}`}>
              Note <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea
              id={`join-notes-${request.id}`}
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              value={notes}
            />
          </Field>
        </FieldGroup>
      ) : null}
    </ConfirmationDialog>
  )
}

function ProjectName({ request }: { request: WorkspaceJoinRequest }) {
  const name = projectName(request)
  const content = (
    <span className="inline-flex max-w-full min-w-0 items-center gap-2">
      <ResourceTypeIcon className="shrink-0" type="project" />
      <span className="truncate">{name}</span>
    </span>
  )
  if (!request.project) return content
  return (
    <SelectableTextLink
      className="block max-w-full text-label"
      render={
        <Link
          params={{ projectMfid: request.project_mfid }}
          to="/projects/$projectMfid"
        />
      }
    >
      {content}
    </SelectableTextLink>
  )
}

function Requester({ request }: { request: WorkspaceJoinRequest }) {
  return request.requester ? (
    <PersonLink
      nameStyle="abbreviated"
      person={request.requester}
      presentation="collection"
    />
  ) : (
    <span className="truncate">{request.requester_id}</span>
  )
}

function ReviewTable({
  requests,
  showProject,
}: {
  requests: readonly WorkspaceJoinRequest[]
  showProject: boolean
}) {
  const [reviewing, setReviewing] = useState<WorkspaceJoinRequest>()
  return (
    <>
      <Table
        aria-label="Requests to join"
        className="identity-directory-table table-fixed"
      >
        <colgroup>
          <col />
          {showProject ? <col /> : null}
          <col className="w-48" />
          <col className="w-28" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Requested by</TableHead>
            {showProject ? <TableHead>Project</TableHead> : null}
            <TableHead kind="date">Requested</TableHead>
            <TableHead kind="action">
              <span className="sr-only">Review</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="identity-directory-account">
                <Requester request={request} />
              </TableCell>
              {showProject ? (
                <TableCell data-label="Project">
                  <ProjectName request={request} />
                </TableCell>
              ) : null}
              <TableCell data-label="Requested" kind="date">
                <LocalDateTime value={request.request_time} />
              </TableCell>
              <TableCell className="identity-directory-action" kind="action">
                <Button
                  onClick={() => setReviewing(request)}
                  size="sm"
                  variant={
                    request.capabilities.can_review ? "outline" : "ghost"
                  }
                  disabled={!request.capabilities.can_review}
                >
                  Review
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ReviewDialog
        onClose={() => setReviewing(undefined)}
        request={reviewing}
      />
    </>
  )
}

function SubmittedTable({
  requests,
}: {
  requests: readonly WorkspaceJoinRequest[]
}) {
  const { withdraw } = useJoinRequestActions()
  const [error, setError] = useState<string>()
  return (
    <>
      {error ? (
        <p className="px-4 pb-3 text-body text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Table
        aria-label="Your requests to join"
        className="identity-directory-table table-fixed"
      >
        <colgroup>
          <col />
          <col className="w-36" />
          <col className="w-48" />
          <col className="w-28" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead kind="date">Requested</TableHead>
            <TableHead kind="action">
              <span className="sr-only">Withdraw</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="resource-directory-name">
                <ProjectName request={request} />
                {request.status === "approved" && request.granted_role ? (
                  <span className="block pl-6 text-supporting text-muted-foreground">
                    Joined as {request.granted_role}
                  </span>
                ) : request.reviewer_notes ? (
                  <span className="block pl-6 text-supporting break-words text-muted-foreground">
                    {request.reviewer_notes}
                  </span>
                ) : null}
              </TableCell>
              <TableCell data-label="Status">
                <StatusBadge domain="join-request" status={request.status} />
              </TableCell>
              <TableCell data-label="Requested" kind="date">
                <LocalDateTime value={request.request_time} />
              </TableCell>
              <TableCell className="identity-directory-action" kind="action">
                {request.capabilities.can_withdraw ? (
                  <Button
                    disabled={withdraw.isPending}
                    onClick={() => {
                      setError(undefined)
                      withdraw.mutate(request.id, {
                        onError: (cause) =>
                          setError(
                            joinRequestError(
                              cause,
                              "The request could not be withdrawn."
                            )
                          ),
                        onSuccess: () => notifySuccess("Request withdrawn"),
                      })
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Withdraw
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}

export function JoinRequestQueue({
  action,
  emptyTitle,
  filters,
  paginate = true,
  title,
}: {
  action?: ReactNode
  emptyTitle: string
  filters: Omit<JoinRequestFilters, "limit">
  paginate?: boolean
  title?: string
}) {
  const scope = useWorkspaceScope()
  const result = useInfiniteQuery(
    joinRequestsInfiniteQueryOptions(scope, filters)
  )
  const items = result.data?.pages.flatMap((page) => page.items) ?? []
  const total = result.data?.pages[0]?.total ?? null
  const updating = result.isFetching && !result.isFetchingNextPage
  const review = filters.scope === "reviewable"

  return (
    <>
      <Card>
        {title || action ? (
          <CardHeader>
            {title ? <CardTitle>{title}</CardTitle> : null}
            {action ? <CardAction>{action}</CardAction> : null}
          </CardHeader>
        ) : null}
        {result.isPending ? (
          <CardContent>
            <Empty className="min-h-32" role="status">
              <EmptyHeader>
                <EmptyTitle>Loading requests</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </CardContent>
        ) : result.isError && !result.data ? (
          <CardContent>
            <Empty className="min-h-40 border" role="alert">
              <EmptyHeader>
                <EmptyTitle>Requests could not be loaded</EmptyTitle>
              </EmptyHeader>
              <Button
                onClick={() => void result.refetch()}
                size="sm"
                variant="outline"
              >
                Retry
              </Button>
            </Empty>
          </CardContent>
        ) : items.length === 0 ? (
          <PendingRegion pending={updating} render={<CardContent />}>
            <Empty className="min-h-32">
              <EmptyHeader>
                <EmptyTitle>{emptyTitle}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </PendingRegion>
        ) : (
          <PendingRegion
            pending={updating}
            render={<CardContent className="px-0" />}
          >
            {review ? (
              <ReviewTable
                requests={items}
                showProject={!filters.projectMfid}
              />
            ) : (
              <SubmittedTable requests={items} />
            )}
          </PendingRegion>
        )}
      </Card>
      {paginate && items.length > 0 ? (
        <CollectionPagination
          disabled={result.isFetching}
          hasNextPage={result.hasNextPage}
          isError={result.isFetchNextPageError}
          isLoading={result.isFetchingNextPage}
          label="join requests"
          loaded={items.length}
          onLoadMore={() => void result.fetchNextPage()}
          total={total}
        />
      ) : null}
    </>
  )
}

export function ProjectJoinRequestsCard({
  projectMfid,
}: {
  projectMfid: string
}) {
  return (
    <JoinRequestQueue
      action={
        <CardViewAllLink
          render={<Link search={{ view: "reviewable" }} to="/join-requests" />}
        />
      }
      emptyTitle="No requests to join"
      filters={{ projectMfid, scope: "reviewable", status: "pending" }}
      paginate={false}
      title="Join requests"
    />
  )
}
