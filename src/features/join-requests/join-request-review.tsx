import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

import { ActivityTime } from "@/components/crucible/activity-time"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { notifySuccess } from "@/components/crucible/notifications"
import { PersonLink } from "@/components/crucible/person-link"
import { SelectableTextLink } from "@/components/crucible/selectable-text-link"
import { StatusBadge } from "@/components/crucible/status-badge"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { joinRequestsQueryOptions } from "@/data/crucible/join-requests.queries"
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
  decision,
  onClose,
  request,
}: {
  decision: "approve" | "reject" | undefined
  onClose: () => void
  request: WorkspaceJoinRequest
}) {
  const { review } = useJoinRequestActions()
  const [role, setRole] = useState<WorkspaceJoinRequestRole>("contributor")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string>()
  const approving = decision === "approve"
  const requester = request.requester
    ? [request.requester.first_name, request.requester.last_name]
        .filter(Boolean)
        .join(" ") ||
      request.requester.username ||
      request.requester_id
    : request.requester_id

  return (
    <ConfirmationDialog
      confirmLabel={approving ? "Approve" : "Reject"}
      description={`${requester} asked to join ${projectName(request)}.`}
      error={error}
      onConfirm={() => {
        if (review.isPending) return
        setError(undefined)
        review.mutate(
          {
            notes,
            requestId: request.id,
            role: approving ? role : undefined,
            status: approving ? "approved" : "rejected",
          },
          {
            onError: (cause) =>
              setError(
                reviewError(
                  cause,
                  approving
                    ? "The request could not be approved."
                    : "The request could not be rejected."
                )
              ),
            onSuccess: () => {
              notifySuccess(approving ? "Request approved" : "Request rejected")
              onClose()
            },
          }
        )
      }}
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
      open={decision !== undefined}
      pending={review.isPending}
      pendingLabel={approving ? "Approving request" : "Rejecting request"}
      title={approving ? "Approve request" : "Reject request"}
      variant={approving ? "default" : "destructive"}
    >
      <FieldGroup>
        {request.reason ? (
          <p className="text-body break-words whitespace-pre-line">
            {request.reason}
          </p>
        ) : null}
        {approving ? (
          <Field>
            <FieldLabel htmlFor={`join-role-${request.id}`}>Role</FieldLabel>
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
        ) : null}
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
    </ConfirmationDialog>
  )
}

function ReviewActions({ request }: { request: WorkspaceJoinRequest }) {
  const [decision, setDecision] = useState<"approve" | "reject">()
  if (!request.capabilities.can_review) return null
  return (
    <span className="flex justify-end gap-2">
      <Button onClick={() => setDecision("reject")} size="sm" variant="outline">
        Reject
      </Button>
      <Button onClick={() => setDecision("approve")} size="sm">
        Approve
      </Button>
      <ReviewDialog
        decision={decision}
        onClose={() => setDecision(undefined)}
        request={request}
      />
    </span>
  )
}

function ProjectCell({ request }: { request: WorkspaceJoinRequest }) {
  const name = projectName(request)
  if (!request.project) return <span>{name}</span>
  return (
    <SelectableTextLink
      className="block truncate"
      render={
        <Link
          params={{ projectMfid: request.project_mfid }}
          to="/projects/$projectMfid"
        />
      }
    >
      {name}
    </SelectableTextLink>
  )
}

export function JoinRequestReviewTable({
  requests,
  showProject,
}: {
  requests: readonly WorkspaceJoinRequest[]
  showProject: boolean
}) {
  return (
    <Table aria-label="Requests to join">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-(--card-spacing)">Person</TableHead>
          {showProject ? <TableHead>Project</TableHead> : null}
          <TableHead className="hidden @2xl:table-cell">Reason</TableHead>
          <TableHead kind="date">Requested</TableHead>
          <TableHead className="pr-(--card-spacing)" kind="action">
            <span className="sr-only">Review</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((request) => (
          <TableRow key={request.id}>
            <TableCell className="max-w-0 pl-(--card-spacing)">
              {request.requester ? (
                <PersonLink
                  person={request.requester}
                  presentation="collection"
                  size="sm"
                />
              ) : (
                request.requester_id
              )}
            </TableCell>
            {showProject ? (
              <TableCell className="max-w-0">
                <ProjectCell request={request} />
              </TableCell>
            ) : null}
            <TableCell className="hidden max-w-0 @2xl:table-cell">
              <span className="block truncate text-muted-foreground">
                {request.reason ?? ""}
              </span>
            </TableCell>
            <TableCell kind="date">
              <ActivityTime fallback="" value={request.request_time} />
            </TableCell>
            <TableCell className="pr-(--card-spacing)" kind="action">
              <ReviewActions request={request} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function SubmittedJoinRequestsTable({
  requests,
}: {
  requests: readonly WorkspaceJoinRequest[]
}) {
  const { withdraw } = useJoinRequestActions()
  const [error, setError] = useState<string>()
  return (
    <>
      {error ? (
        <p
          className="px-(--card-spacing) text-body text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <Table aria-label="Your requests to join">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-(--card-spacing)">Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead kind="date">Requested</TableHead>
            <TableHead className="pr-(--card-spacing)" kind="action">
              <span className="sr-only">Withdraw</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="max-w-0 pl-(--card-spacing)">
                <ProjectCell request={request} />
                {request.status === "approved" && request.granted_role ? (
                  <span className="block text-supporting text-muted-foreground">
                    Joined as {request.granted_role}
                  </span>
                ) : request.reviewer_notes ? (
                  <span className="block text-supporting break-words text-muted-foreground">
                    {request.reviewer_notes}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>
                <StatusBadge domain="join-request" status={request.status} />
              </TableCell>
              <TableCell kind="date">
                <ActivityTime fallback="" value={request.request_time} />
              </TableCell>
              <TableCell className="pr-(--card-spacing)" kind="action">
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

export function ProjectJoinRequestsCard({
  projectMfid,
}: {
  projectMfid: string
}) {
  const scope = useWorkspaceScope()
  const result = useQuery(
    joinRequestsQueryOptions(scope, {
      projectMfid,
      scope: "reviewable",
      status: "pending",
    })
  )
  const requests = result.data?.items ?? []
  if (requests.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Requests to join</CardTitle>
        <CardAction>
          <Badge variant="outline">{requests.length}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <JoinRequestReviewTable requests={requests} showProject={false} />
      </CardContent>
    </Card>
  )
}
