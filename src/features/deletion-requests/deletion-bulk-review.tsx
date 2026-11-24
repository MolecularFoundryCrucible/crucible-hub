import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { notifySuccess } from "@/components/crucible/notifications"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { invalidateDeletionRequestMutationQueries } from "@/data/crucible/cache-effects"
import { reviewWorkspaceDeletionRequestById } from "@/data/crucible/deletion-requests.functions"
import type { WorkspaceDeletionReviewDecision } from "@/data/crucible/deletion-requests.server"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type { WorkspaceDeletionRequest } from "@/data/crucible/workspace-source"

export function BulkReviewController({
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
  const [decision, setDecision] = useState<WorkspaceDeletionReviewDecision>()
  const requests = items.filter(
    (request) =>
      selectedRequestIds.has(request.id) && isReviewableDeletionRequest(request)
  )
  return (
    <>
      {children(
        requests.length > 0 ? (
          <BulkReviewActions
            count={requests.length}
            onApprove={() => setDecision("approved")}
            onReject={() => setDecision("rejected")}
          />
        ) : undefined
      )}
      {decision ? (
        <BulkReviewDialog
          decision={decision}
          key={decision}
          onClose={() => setDecision(undefined)}
          onSelectionChange={onSelectionChange}
          requests={requests}
          scope={scope}
        />
      ) : null}
    </>
  )
}

type BulkReviewOutcome = {
  failed: Array<{ error: unknown; request: WorkspaceDeletionRequest }>
  remaining: WorkspaceDeletionRequest[]
  reviewed: WorkspaceDeletionRequest[]
  stopped: boolean
}

function BulkReviewDialog({
  decision,
  onClose,
  onSelectionChange,
  requests,
  scope,
}: {
  decision: WorkspaceDeletionReviewDecision
  onClose: () => void
  onSelectionChange: React.Dispatch<React.SetStateAction<Set<number>>>
  requests: readonly WorkspaceDeletionRequest[]
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const stopRequested = useRef(false)
  const [finalizing, setFinalizing] = useState(false)
  const [progress, setProgress] = useState({
    completed: 0,
    total: requests.length,
  })
  const [reviewError, setReviewError] = useState<string>()
  const [reviewStatus, setReviewStatus] = useState<string>()
  const [reviewerNotes, setReviewerNotes] = useState("")
  const [stopping, setStopping] = useState(false)
  const mutation = useMutation({
    mutationFn: async ({ notes }: { notes?: string }) => {
      const outcome: BulkReviewOutcome = {
        failed: [],
        remaining: [],
        reviewed: [],
        stopped: false,
      }
      setProgress({ completed: 0, total: requests.length })
      for (const [index, request] of requests.entries()) {
        if (stopRequested.current) {
          outcome.stopped = true
          outcome.remaining.push(...requests.slice(index))
          break
        }
        setProgress({ completed: index, total: requests.length })
        try {
          const reviewed = unwrapHubResult(
            await reviewWorkspaceDeletionRequestById({
              data: {
                decision,
                privilegeMode: privilegeModeFromScope(scope),
                requestId: request.id,
                reviewerNotes: notes,
                scenario: fixtureScenarioFromScope(scope),
              },
            })
          )
          outcome.reviewed.push(reviewed)
        } catch (error) {
          outcome.failed.push({ error, request })
        }
        setProgress({ completed: index + 1, total: requests.length })
      }
      return outcome
    },
  })

  async function reviewSelected() {
    if (requests.length === 0) return
    stopRequested.current = false
    setStopping(false)
    setReviewError(undefined)
    setReviewStatus(undefined)
    try {
      const outcome = await mutation.mutateAsync({
        notes: reviewerNotes.trim() || undefined,
      })
      setFinalizing(true)
      onSelectionChange(
        new Set([
          ...outcome.failed.map(({ request }) => request.id),
          ...outcome.remaining.map((request) => request.id),
        ])
      )
      await invalidateDeletionRequestMutationQueries(
        queryClient,
        scope,
        outcome.reviewed.map((request) => request.resource_mfid)
      )
      if (outcome.stopped) {
        setFinalizing(false)
        setReviewStatus(
          `Stopped after ${outcome.reviewed.length + outcome.failed.length} of ${requests.length}. Unprocessed requests remain selected.`
        )
        return
      }
      if (outcome.failed.length > 0) {
        setFinalizing(false)
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
      setFinalizing(false)
      onClose()
    } catch (error) {
      setFinalizing(false)
      setReviewError(
        hubErrorMessage(error, "The selected requests could not be reviewed.")
      )
    }
  }

  const action = decision === "approved" ? "Approving" : "Rejecting"
  const pending = mutation.isPending || finalizing
  return (
    <ConfirmationDialog
      kind="alert"
      confirmLabel={
        decision === "approved" ? "Approve deletion" : "Reject requests"
      }
      description={`${requests.length} selected request${requests.length === 1 ? "" : "s"}.`}
      error={reviewError}
      onCancelPending={
        mutation.isPending
          ? () => {
              stopRequested.current = true
              setStopping(true)
            }
          : undefined
      }
      onConfirm={() => void reviewSelected()}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      open
      pending={pending}
      pendingCancelDisabled={stopping}
      pendingCancelLabel={stopping ? "Stopping" : "Stop batch"}
      pendingLabel={
        finalizing
          ? "Refreshing"
          : `${action} ${Math.min(progress.completed + 1, progress.total)} of ${progress.total}`
      }
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
          disabled={pending}
          id="bulk-deletion-review-notes"
          maxLength={2_000}
          onChange={(event) => setReviewerNotes(event.target.value)}
          value={reviewerNotes}
        />
      </Field>
      {pending ? (
        <div
          aria-live="polite"
          className="flex items-center gap-2 text-body text-muted-foreground"
          role="status"
        >
          <PendingIcon />
          <span>
            {finalizing
              ? "Refreshing deletion requests"
              : stopping
                ? `Stopping after the current request (${Math.min(progress.completed + 1, progress.total)} of ${progress.total})`
                : `${action} request ${Math.min(progress.completed + 1, progress.total)} of ${progress.total}`}
          </span>
        </div>
      ) : reviewStatus ? (
        <p className="text-body" role="status">
          {reviewStatus}
        </p>
      ) : null}
    </ConfirmationDialog>
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

export function isReviewableDeletionRequest(request: WorkspaceDeletionRequest) {
  return request.status === "pending" && request.capabilities.can_review
}
