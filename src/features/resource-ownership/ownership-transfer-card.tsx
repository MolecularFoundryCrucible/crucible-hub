import { useId, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { resourceDetailDisplayName } from "@/lib/resource-name"

import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
import { ManagementAction } from "@/components/crucible/management-action"
import { personDisplayName } from "@/components/crucible/person-identity"
import { ResourceSearchCombobox } from "@/components/crucible/resource-search-combobox"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { invalidateResourceMutationQueries } from "@/data/crucible/cache-effects"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  confirmWorkspaceResourceOwnership,
  previewWorkspaceResourceOwnership,
} from "@/data/crucible/resources.functions"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceOwnershipTransfer,
  WorkspaceProject,
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

export function OwnershipTransferCard({
  mode,
  onSuccess,
  presentation,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  onSuccess?: (result: WorkspaceOwnershipTransfer) => void
  presentation?: "card" | "row"
  resource: WorkspaceResourceDetail
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const searchInputId = useId()
  const [chooserOpen, setChooserOpen] = useState(false)
  const [personQuery, setPersonQuery] = useState("")
  const [preview, setPreview] = useState<WorkspaceOwnershipTransfer>()
  const [error, setError] = useState<string>()
  const previewMutation = useMutation({
    mutationFn: async (newOwner: string) =>
      unwrapHubResult(
        await previewWorkspaceResourceOwnership({
          data: {
            newOwner,
            resourceMfid: resource.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })
  const confirmMutation = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await confirmWorkspaceResourceOwnership({
          data: {
            newOwner: preview?.new_owner.unique_id ?? "",
            resourceMfid: resource.unique_id,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })

  async function choosePerson(person: WorkspaceSearchResult) {
    setError(undefined)
    try {
      setPreview(await previewMutation.mutateAsync(person.unique_id))
      setChooserOpen(false)
    } catch (caught) {
      setError(operationError(caught, "preview this ownership transfer"))
    }
  }

  async function confirm() {
    if (!preview) return
    setError(undefined)
    try {
      const result = await confirmMutation.mutateAsync()
      queryClient.setQueriesData<WorkspaceResourceDetail | null>(
        { queryKey: crucibleKeys.resourceDetails(scope, resource.unique_id) },
        (current) =>
          current
            ? {
                ...current,
                capabilities: current.capabilities
                  ? { ...current.capabilities, can_transfer: false }
                  : null,
                owner: result.new_owner,
              }
            : current
      )
      if (resource.kind === "project") {
        queryClient.setQueriesData<WorkspaceProject>(
          { queryKey: crucibleKeys.project(scope, resource.unique_id) },
          (current) =>
            current && "organization" in current
              ? {
                  ...current,
                  capabilities: current.capabilities
                    ? { ...current.capabilities, can_transfer: false }
                    : null,
                  lead: result.new_owner,
                  project_lead_orcid: result.new_owner.unique_id,
                }
              : current
        )
      }
      invalidateOwnershipQueries()
      setPreview(undefined)
      onSuccess?.(result)
    } catch (caught) {
      setError(operationError(caught, "transfer ownership"))
    }
  }

  function invalidateOwnershipQueries() {
    if (mode !== "api") return
    void invalidateResourceMutationQueries(
      queryClient,
      scope,
      resource.kind,
      resource.unique_id
    )
  }

  function closeChooser(nextOpen: boolean) {
    if (previewMutation.isPending) return
    setChooserOpen(nextOpen)
    if (!nextOpen) setPersonQuery("")
  }

  if (resource.capabilities?.can_transfer !== true) return null

  return (
    <>
      <ManagementAction
        action={
          <Button onClick={() => setChooserOpen(true)} type="button">
            Choose person
          </Button>
        }
        description="Select the next owner, then confirm their name and username before transferring ownership."
        presentation={presentation}
        title="Transfer ownership"
      >
        {error && !chooserOpen && !preview ? (
          <p className="text-body text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </ManagementAction>
      <Dialog onOpenChange={closeChooser} open={chooserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a new owner</DialogTitle>
          </DialogHeader>
          <ResourceSearchCombobox
            disabled={previewMutation.isPending}
            excludedIds={
              resource.owner?.unique_id ? [resource.owner.unique_id] : []
            }
            id={searchInputId}
            kind="person"
            onQueryChange={setPersonQuery}
            onValueChange={(person) => {
              if (person) void choosePerson(person)
            }}
            query={personQuery}
            scope={scope}
            value={undefined}
          />
          {error && chooserOpen ? (
            <p className="text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmationAlertDialog
        confirmLabel="Confirm transfer"
        description={
          preview ? (
            <>
              Ownership of{" "}
              <strong>{resourceDetailDisplayName(resource)}</strong> will
              transfer to <strong>{personName(preview.new_owner)}</strong>.
            </>
          ) : null
        }
        error={error}
        onOpenChange={(open) => {
          if (!open && !confirmMutation.isPending) {
            setPreview(undefined)
            setError(undefined)
          }
        }}
        onConfirm={() => void confirm()}
        open={Boolean(preview)}
        pending={confirmMutation.isPending}
        title="Transfer ownership?"
      />
    </>
  )
}

function personName(person: WorkspaceOwnershipTransfer["new_owner"]) {
  return personDisplayName(person)
}

function operationError(error: unknown, action: string) {
  return hubErrorMessage(error, `Could not ${action}. Try again.`)
}
