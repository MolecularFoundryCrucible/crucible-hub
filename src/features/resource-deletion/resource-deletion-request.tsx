import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  DeletionRequestedIcon,
  PreparingDownloadIcon,
  RequestDeletionIcon,
} from "@/components/crucible/icons"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { createWorkspaceResourceDeletionRequest } from "@/data/crucible/resources.functions"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceDeletionRequest,
  WorkspaceResourceDetail,
} from "@/data/crucible/workspace-source"

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

export function ResourceDeletionRequestAction({
  mode,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
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
        void queryClient.invalidateQueries({
          exact: true,
          queryKey: resourceQuery.queryKey,
        })
        void queryClient.invalidateQueries({
          queryKey:
            resource.kind === "sample"
              ? crucibleKeys.sampleLists(scope)
              : crucibleKeys.datasetLists(scope),
        })
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.searches(scope),
        })
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

  if (activeRequest) {
    const label = deletionRequestStatusLabel(activeRequest.status)
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={label}
              disabled
              size="icon-sm"
              variant="outline"
            />
          }
        >
          <DeletionRequestedIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={`Request deletion of ${resource.name}`}
              onClick={() => setOpen(true)}
              size="icon-sm"
              variant="outline"
            />
          }
        >
          <RequestDeletionIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>
          Request deletion: <ResourceName>{resource.name}</ResourceName>
        </TooltipContent>
      </Tooltip>
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
                This submits <ResourceName>{resource.name}</ResourceName> for
                review. It does not immediately delete the {resource.kind} or
                its files.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="deletion-request-reason">
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
                <FieldDescription>
                  Optional, up to 2,000 characters.
                </FieldDescription>
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
                aria-label={
                  mutation.isPending
                    ? "Submitting deletion request"
                    : "Submit deletion request"
                }
                disabled={mutation.isPending}
                type="submit"
                variant="destructive"
              >
                {mutation.isPending ? (
                  <PreparingDownloadIcon
                    aria-hidden="true"
                    className="motion-safe:animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <RequestDeletionIcon
                    aria-hidden="true"
                    data-icon="inline-start"
                  />
                )}
                Submit request
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
