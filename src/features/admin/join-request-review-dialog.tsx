import { useState } from "react"
import { useMutation } from "@tanstack/react-query"

import { SavingChangesIcon } from "@/components/crucible/icons"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidText } from "@/components/crucible/mfid-text"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { reviewWorkspaceJoinRequestFn } from "@/data/crucible/join-requests.functions"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type { WorkspaceJoinRequest } from "@/data/crucible/workspace-source"

export function JoinRequestReviewDialog({
  onOpenChange,
  onReviewed,
  open,
  request,
  scope,
}: {
  onOpenChange: (open: boolean) => void
  onReviewed: (updated: WorkspaceJoinRequest) => void
  open: boolean
  request: WorkspaceJoinRequest | null
  scope: IdentityScope
}) {
  const [decision, setDecision] = useState<"approved" | "rejected">("approved")
  const [reviewerNotes, setReviewerNotes] = useState("")
  const [error, setError] = useState<string>()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!request) throw new Error("No request selected")
      return unwrapHubResult(
        await reviewWorkspaceJoinRequestFn({
          data: {
            requestId: request.id,
            review: {
              reviewer_notes: reviewerNotes.trim() || null,
              status: decision,
            },
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      )
    },
    onSuccess: (updated) => {
      onOpenChange(false)
      onReviewed(updated)
    },
    onError: (err) => {
      setError(hubErrorMessage(err, "Failed to review join request."))
    },
  })

  if (!request) return null

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent showCloseButton={!mutation.isPending}>
        <DialogHeader>
          <DialogTitle>Review join request #{request.id}</DialogTitle>
          <DialogDescription>
            Approve or reject this request to join the access group.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <dl className="grid gap-3 text-body">
            <div>
              <dt className="text-label text-muted-foreground">Access group</dt>
              <dd className="mt-0.5">{request.group_name}</dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">Requester</dt>
              <dd className="mt-0.5">
                <MfidText value={request.requester_id} />
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">Reason</dt>
              <dd className="mt-0.5 text-muted-foreground">
                {request.reason || "None specified"}
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">Requested</dt>
              <dd className="mt-0.5">
                {request.request_time ? (
                  <LocalDateTime value={request.request_time} />
                ) : (
                  "Unknown"
                )}
              </dd>
            </div>
          </dl>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="review-decision">Decision</FieldLabel>
              <NativeSelect
                disabled={mutation.isPending}
                id="review-decision"
                onChange={(e) =>
                  setDecision(e.target.value as "approved" | "rejected")
                }
                value={decision}
              >
                <NativeSelectOption value="approved">
                  Approve request
                </NativeSelectOption>
                <NativeSelectOption value="rejected">
                  Reject request
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="reviewer-notes" optional>
                Reviewer notes
              </FieldLabel>
              <Textarea
                disabled={mutation.isPending}
                id="reviewer-notes"
                maxLength={1000}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Optional notes explaining the decision"
                rows={3}
                value={reviewerNotes}
              />
            </Field>
          </FieldGroup>
          {error ? (
            <p className="text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            type="button"
            variant={decision === "approved" ? "default" : "destructive"}
          >
            {mutation.isPending ? (
              <SavingChangesIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
                data-icon="inline-start"
              />
            ) : null}
            {decision === "approved" ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
