import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { resourceDetailDisplayName } from "@/lib/resource-name"

import { RequestDeletionIcon } from "@/components/crucible/icons"
import { ManagementAction } from "@/components/crucible/management-action"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { ResourceName } from "@/components/crucible/resource-name"
import { Button } from "@/components/ui/button"
import { invalidateResourceDeletionQueries } from "@/data/crucible/cache-effects"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  confirmWorkspaceResourceDeletion,
  previewWorkspaceResourceDeletion,
} from "@/data/crucible/resources.functions"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceDeletionPreview,
  WorkspaceResourceDetail,
} from "@/data/crucible/workspace-source"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"

type DeletableResource = Extract<
  WorkspaceResourceDetail,
  { kind: "instrument" | "project" }
>

export function ResourceForcedDeletionCard({
  onSuccess,
  presentation,
  resource,
  scope,
}: {
  onSuccess?: () => void
  presentation?: "card" | "row"
  resource: DeletableResource
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<WorkspaceDeletionPreview>()
  const [error, setError] = useState<string>()
  const [confirmation, setConfirmation] = useState("")
  const [opening, setOpening] = useState(false)
  const previewMutation = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await previewWorkspaceResourceDeletion({
          data: {
            confirm: false,
            privilegeMode: privilegeModeFromScope(scope),
            resourceMfid: resource.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const confirmMutation = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await confirmWorkspaceResourceDeletion({
          data: {
            confirm: true,
            privilegeMode: privilegeModeFromScope(scope),
            resourceMfid: resource.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })

  async function openDialog() {
    if (opening || previewMutation.isPending || confirmMutation.isPending) {
      return
    }
    setError(undefined)
    setPreview(undefined)
    setConfirmation("")
    setOpening(true)
    try {
      setPreview(await previewMutation.mutateAsync())
    } catch (caught) {
      setError(deletionError(caught, "review this deletion"))
    } finally {
      setOpening(false)
    }
    setOpen(true)
  }

  async function confirm() {
    setError(undefined)
    try {
      await confirmMutation.mutateAsync()
      void invalidateResourceDeletionQueries(
        queryClient,
        scope,
        resource.kind,
        resource.unique_id
      )
      setOpen(false)
      setPreview(undefined)
      onSuccess?.()
    } catch (caught) {
      setError(deletionError(caught, "delete this resource"))
      if (preview) {
        void previewMutation.mutateAsync().then(
          (next) => setPreview(next),
          () => undefined
        )
      }
    }
  }

  function closeDialog(nextOpen: boolean) {
    if (previewMutation.isPending || confirmMutation.isPending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setError(undefined)
      setPreview(undefined)
      setConfirmation("")
    }
  }

  if (resource.capabilities?.can_delete !== true) return null

  const blocked = blockingSummary(preview)
  const pending = previewMutation.isPending || confirmMutation.isPending

  return (
    <>
      <ManagementAction
        action={
          <Button
            aria-label={`Delete ${resourceDetailDisplayName(resource)} permanently`}
            disabled={opening}
            onClick={() => void openDialog()}
            type="button"
            variant="destructive"
          >
            {opening ? (
              <PendingIcon data-icon="inline-start" />
            ) : (
              <RequestDeletionIcon
                aria-hidden="true"
                data-icon="inline-start"
              />
            )}
            Delete permanently
          </Button>
        }
        description={
          <>
            Removes this {resource.kind}, its access group, memberships, join
            requests, operator bindings, and grants. Stored files are not
            deleted.
          </>
        }
        presentation={presentation}
        title="Delete permanently"
      />
      <ConfirmationDialog
        confirmDisabled={
          !preview || Boolean(blocked) || confirmation !== "DELETE"
        }
        confirmLabel="Delete permanently"
        description={
          <>
            This permanently removes{" "}
            <ResourceName>{resourceDetailDisplayName(resource)}</ResourceName>{" "}
            and its access group. Stored files are not deleted.
          </>
        }
        error={error}
        onConfirm={() => void confirm()}
        onOpenChange={closeDialog}
        open={open}
        pending={pending}
        pendingLabel={
          confirmMutation.isPending ? "Deleting permanently" : "Checking impact"
        }
        title="Delete permanently?"
        variant="destructive"
      >
        {preview ? (
          <ul className="flex flex-col gap-1 text-body text-muted-foreground">
            {preview.memberships_removed > 0 ? (
              <li>
                {preview.memberships_removed}{" "}
                {preview.memberships_removed === 1 ? "member" : "members"}{" "}
                unlinked
              </li>
            ) : null}
            {preview.join_requests_removed > 0 ? (
              <li>
                {preview.join_requests_removed}{" "}
                {preview.join_requests_removed === 1
                  ? "join request"
                  : "join requests"}{" "}
                removed
              </li>
            ) : null}
            {preview.service_accounts_unbound > 0 ? (
              <li>
                {preview.service_accounts_unbound}{" "}
                {preview.service_accounts_unbound === 1
                  ? "operator"
                  : "operators"}{" "}
                unbound
              </li>
            ) : null}
            {preview.removed_grants.length > 0 ? (
              <li>
                {preview.removed_grants.length}{" "}
                {preview.removed_grants.length === 1 ? "grant" : "grants"} held
                on other resources removed
              </li>
            ) : null}
            {blocked ? <li>{blocked}</li> : null}
          </ul>
        ) : null}
        <Field>
          <FieldLabel htmlFor={`confirm-delete-${resource.unique_id}`}>
            Type DELETE to confirm
          </FieldLabel>
          <Input
            autoComplete="off"
            disabled={confirmMutation.isPending}
            id={`confirm-delete-${resource.unique_id}`}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="DELETE"
            value={confirmation}
          />
        </Field>
      </ConfirmationDialog>
    </>
  )
}

function blockingSummary(preview: WorkspaceDeletionPreview | undefined) {
  if (!preview || Object.keys(preview.blocking).length === 0) return null
  const entityLabels: Record<string, [string, string]> = {
    datasets: ["dataset", "datasets"],
    samples: ["sample", "samples"],
  }
  const parts = Object.entries(preview.blocking)
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([entity, count]) => {
      const labels = entityLabels[entity] ?? [entity, entity]
      return `${count} ${count === 1 ? labels[0] : labels[1]} still assigned`
    })
  return parts.length > 0
    ? `Deletion is blocked: ${parts.join(", ")}. Reassign them first.`
    : null
}

function deletionError(error: unknown, action: string) {
  if (error instanceof HubApiClientError && error.details.kind === "conflict") {
    return "This resource is not empty, so it cannot be deleted. Reassign its datasets and samples first."
  }
  return `Could not ${action}. Try again.`
}
