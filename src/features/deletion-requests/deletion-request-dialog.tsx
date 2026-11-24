import { InlineError } from "@/components/crucible/form-error"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { StatusBadge } from "@/components/crucible/status-badge"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { MfidText } from "@/components/crucible/mfid-text"
import { notifySuccess } from "@/components/crucible/notifications"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { invalidateDeletionRequestMutationQueries } from "@/data/crucible/cache-effects"
import { reviewWorkspaceDeletionRequestById } from "@/data/crucible/deletion-requests.functions"
import type { WorkspaceDeletionReviewDecision } from "@/data/crucible/deletion-requests.server"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import {
  crucibleKeys,
  privilegeModeFromScope,
} from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceAccount,
  WorkspaceDeletionRequest,
} from "@/data/crucible/workspace-source"
import { useExitSafeValue } from "@/hooks/use-exit-safe"

import { resourceKind } from "./deletion-request-table"

export function DeletionRequestDialog({
  account,
  onOpenChange,
  request: selectedRequest,
  scope,
}: {
  account: WorkspaceAccount
  onOpenChange: (open: boolean) => void
  request?: WorkspaceDeletionRequest
  scope: IdentityScope
}) {
  const exit = useExitSafeValue(selectedRequest)
  const request = exit.value
  const queryClient = useQueryClient()
  const [reviewerNotes, setReviewerNotes] = useState("")
  const mutation = useMutation({
    mutationFn: async (decision: WorkspaceDeletionReviewDecision) => {
      if (!request) throw new Error("No deletion request is selected.")
      return unwrapHubResult(
        await reviewWorkspaceDeletionRequestById({
          data: {
            decision,
            privilegeMode: privilegeModeFromScope(scope),
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
        reviewed.resource_mfid
      )
      notifySuccess(
        decision === "approved"
          ? "Deletion request approved"
          : "Deletion request rejected"
      )
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
        onOpenChange(open)
      }}
      onOpenChangeComplete={(open) => {
        exit.onOpenChangeComplete(open)
        if (!open) {
          setReviewerNotes("")
          mutation.reset()
        }
      }}
      open={Boolean(selectedRequest)}
    >
      <DialogContent showCloseButton={!mutation.isPending}>
        {request ? (
          <>
            <DialogHeader>
              <DialogTitle>Deletion request</DialogTitle>
            </DialogHeader>
            <ResourceIdentity
              kind={resourceKind(request.resource_type)}
              mfid={request.resource_mfid}
              name={request.resource_name?.trim() || "Untitled resource"}
              projectId={request.project_id}
            />
            <dl className="grid grid-cols-2 gap-4 text-body">
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
                  <StatusBadge
                    domain="deletion-request"
                    status={request.status}
                  />
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
              <InlineError>
                {hubErrorMessage(
                  mutation.error,
                  "The deletion request could not be reviewed. Your notes are still here."
                )}
              </InlineError>
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
                    {mutation.isPending && mutation.variables === "rejected" ? (
                      <>
                        <PendingIcon data-icon="inline-start" />
                        Rejecting deletion
                      </>
                    ) : (
                      "Reject deletion"
                    )}
                  </Button>
                  <Button
                    disabled={mutation.isPending}
                    onClick={() => void review("approved")}
                    type="button"
                    variant="destructive-solid"
                  >
                    {mutation.isPending && mutation.variables === "approved" ? (
                      <>
                        <PendingIcon data-icon="inline-start" />
                        Approving deletion
                      </>
                    ) : (
                      "Approve deletion"
                    )}
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
