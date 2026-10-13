import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { resourceDetailDisplayName } from "@/lib/resource-name"

import {
  DeletionRequestedIcon,
  RequestDeletionIcon,
} from "@/components/crucible/icons"
import { ManagementAction } from "@/components/crucible/management-action"
import { ResourceName } from "@/components/crucible/resource-name"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { invalidateDeletionRequestMutationQueries } from "@/data/crucible/cache-effects"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { createWorkspaceResourceDeletionRequest } from "@/data/crucible/resources.functions"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceDeletionRequest,
  WorkspaceResourceDetail,
} from "@/data/crucible/workspace-source"
import { PendingIcon } from "@/components/crucible/pending-icon"

type DeletableResource = Extract<
  WorkspaceResourceDetail,
  { kind: "dataset" | "sample" }
>

export function mergeResourceDeletionRequest(
  resource: WorkspaceResourceDetail | null | undefined,
  deletionRequest: WorkspaceDeletionRequest
): WorkspaceResourceDetail | null | undefined {
  if (
    !resource ||
    (resource.kind !== "dataset" && resource.kind !== "sample")
  ) {
    return resource
  }
  return { ...resource, deletion_request: deletionRequest }
}

export function ResourceDeletionRequestCard({
  mode,
  presentation,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  presentation?: "card" | "compact" | "row"
  resource: DeletableResource
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await createWorkspaceResourceDeletionRequest({
          data: {
            privilegeMode: privilegeModeFromScope(scope),
            reason: reason.trim() || undefined,
            resourceMfid: resource.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const activeRequest = resource.deletion_request

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(undefined)
    try {
      const confirmed = await mutation.mutateAsync()
      const resourceQuery = resourceQueryOptions(scope, resource.unique_id)
      queryClient.setQueryData(resourceQuery.queryKey, (current) =>
        mergeResourceDeletionRequest(current, confirmed)
      )
      if (mode === "api") {
        void invalidateDeletionRequestMutationQueries(
          queryClient,
          scope,
          resource.unique_id
        )
      }
      setOpen(false)
      setReason("")
    } catch (caught) {
      if (
        caught instanceof HubApiClientError &&
        caught.details.kind === "conflict"
      ) {
        void queryClient.invalidateQueries({
          exact: true,
          queryKey: resourceQueryOptions(scope, resource.unique_id).queryKey,
        })
      }
      setError(deletionRequestError(caught))
    }
  }

  const action = activeRequest ? (
    <Button
      aria-label={deletionRequestStatusLabel(activeRequest.status)}
      className={presentation === "compact" ? "w-full" : undefined}
      disabled
      variant="outline"
    >
      <DeletionRequestedIcon aria-hidden="true" data-icon="inline-start" />
      {presentation === "compact"
        ? "Delete"
        : deletionRequestStatusLabel(activeRequest.status)}
    </Button>
  ) : (
    <Button
      aria-label={`Request deletion of ${resourceDetailDisplayName(resource)}`}
      className={presentation === "compact" ? "w-full" : undefined}
      onClick={() => setOpen(true)}
      variant="destructive"
    >
      <RequestDeletionIcon aria-hidden="true" data-icon="inline-start" />
      {presentation === "compact" ? "Delete" : "Request deletion"}
    </Button>
  )

  return (
    <>
      {presentation === "compact" ? (
        action
      ) : (
        <ManagementAction
          action={action}
          description={
            <>
              Submit this {resource.kind} for deletion review. It becomes hidden
              from discovery while the request is pending.
            </>
          }
          presentation={presentation}
          title="Request deletion"
        />
      )}
      <Dialog
        onOpenChange={(nextOpen) => {
          if (mutation.isPending) return
          setOpen(nextOpen)
          if (!nextOpen) {
            setError(undefined)
            setReason("")
          }
        }}
        open={open}
      >
        <DialogContent showCloseButton={!mutation.isPending}>
          <form className="contents" onSubmit={(event) => void submit(event)}>
            <DialogHeader>
              <DialogTitle>Request deletion?</DialogTitle>
              <DialogDescription>
                This submits{" "}
                <ResourceName>
                  {resourceDetailDisplayName(resource)}
                </ResourceName>{" "}
                for review. It becomes hidden from collections, search, facets,
                and graphs while the request is pending.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="deletion-request-reason" optional>
                  Reason
                </FieldLabel>
                <Textarea
                  disabled={mutation.isPending}
                  id="deletion-request-reason"
                  maxLength={2000}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Why should this resource be deleted?"
                  value={reason}
                />
                <FieldDescription>Up to 2,000 characters.</FieldDescription>
              </Field>
              {error ? (
                <p className="text-body text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </FieldGroup>
            <DialogFooter>
              <Button
                disabled={mutation.isPending}
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={mutation.isPending}
                type="submit"
                variant="destructive"
              >
                {mutation.isPending ? (
                  <PendingIcon data-icon="inline-start" />
                ) : null}
                {mutation.isPending
                  ? "Submitting deletion request"
                  : "Submit deletion request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function deletionRequestStatusLabel(status: string | null) {
  if (!status) return "Deletion request submitted"
  const label = status.replaceAll(/[_-]+/g, " ").trim()
  return `Deletion request ${label || "submitted"}`
}

function deletionRequestError(error: unknown) {
  if (error instanceof HubApiClientError) {
    if (error.details.kind === "conflict") {
      return "A deletion request is already active for this resource."
    }
    if (error.details.kind === "forbidden") {
      return "You do not have permission to request deletion of this resource."
    }
    if (error.details.kind === "validation") {
      return "The deletion request could not be submitted. Check the reason and try again."
    }
  }
  return "The deletion request could not be submitted. Your reason is still here."
}
