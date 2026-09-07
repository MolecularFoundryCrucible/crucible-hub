import { useId, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { SavingChangesIcon } from "@/components/crucible/icons"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  confirmWorkspaceResourceOwnership,
  previewWorkspaceResourceOwnership,
} from "@/data/crucible/resources.functions"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import { searchQueryOptions } from "@/data/crucible/search.queries"
import type {
  WorkspaceOwnershipTransfer,
  WorkspaceProject,
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

export function OwnershipTransferCard({
  className,
  mode,
  onSuccess,
  resource,
  scope,
}: {
  className?: string
  mode: "api" | "fixture"
  onSuccess?: (result: WorkspaceOwnershipTransfer) => void
  resource: WorkspaceResourceDetail
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const searchInputId = useId()
  const [chooserOpen, setChooserOpen] = useState(false)
  const [personQuery, setPersonQuery] = useState("")
  const [preview, setPreview] = useState<WorkspaceOwnershipTransfer>()
  const [error, setError] = useState<string>()
  const normalizedQuery = personQuery.trim()
  const search = useQuery({
    ...searchQueryOptions(scope, normalizedQuery, ["person"]),
    enabled: chooserOpen && normalizedQuery.length >= 3,
  })
  const people =
    search.data?.groups.find((group) => group.kind === "person")?.items ?? []
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
      queryClient.setQueryData<WorkspaceResourceDetail | null>(
        resourceQueryOptions(scope, resource.unique_id).queryKey,
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
        queryClient.setQueryData<WorkspaceProject>(
          crucibleKeys.project(scope, resource.unique_id),
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
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: resourceQueryOptions(scope, resource.unique_id).queryKey,
    })
    void queryClient.invalidateQueries({
      queryKey: resourceListKey(resource.kind, scope),
    })
    if (resource.kind === "project") {
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: crucibleKeys.project(scope, resource.unique_id),
      })
    }
    void queryClient.invalidateQueries({
      queryKey: crucibleKeys.searches(scope),
    })
  }

  function closeChooser(nextOpen: boolean) {
    if (previewMutation.isPending) return
    setChooserOpen(nextOpen)
    if (!nextOpen) setPersonQuery("")
  }

  if (resource.capabilities?.can_transfer !== true) return null

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Transfer ownership</CardTitle>
        <CardDescription>
          Select the next owner, then confirm their name and username before
          transferring ownership.
        </CardDescription>
        <CardAction>
          <Button onClick={() => setChooserOpen(true)} type="button">
            Choose person
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-body text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
      <Dialog onOpenChange={closeChooser} open={chooserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a new owner</DialogTitle>
            <DialogDescription>
              Search for a person and select a candidate for server preview.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={searchInputId}>Search people</FieldLabel>
            <Input
              autoComplete="off"
              id={searchInputId}
              onChange={(event) => setPersonQuery(event.target.value)}
              placeholder="Name or identifier"
              type="search"
              value={personQuery}
            />
          </Field>
          {normalizedQuery.length < 3 ? null : search.isPending ||
            search.isPlaceholderData ? (
            <p className="text-body text-muted-foreground" role="status">
              Searching people...
            </p>
          ) : search.isError ? (
            <p className="text-body text-destructive" role="alert">
              People could not be searched.
            </p>
          ) : people.length === 0 ? (
            <p className="text-body text-muted-foreground">
              No people matched this search.
            </p>
          ) : (
            <ul
              aria-label="People search results"
              className="flex flex-col gap-1"
            >
              {people.map((person) => {
                const isCurrentOwner =
                  person.unique_id === resource.owner?.unique_id
                return (
                  <li key={person.unique_id}>
                    <Button
                      className="h-auto w-full justify-start py-2 whitespace-normal"
                      disabled={previewMutation.isPending || isCurrentOwner}
                      onClick={() => void choosePerson(person)}
                      type="button"
                      variant="ghost"
                    >
                      <span className="text-left">
                        <span className="block text-label">
                          {person.name}
                          {isCurrentOwner ? " (current owner)" : ""}
                        </span>
                        {person.context ? (
                          <span className="block text-supporting text-muted-foreground">
                            {person.context}
                          </span>
                        ) : null}
                      </span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          {error && chooserOpen ? (
            <p className="text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !confirmMutation.isPending) {
            setPreview(undefined)
            setError(undefined)
          }
        }}
        open={Boolean(preview)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              {preview ? (
                <>
                  Ownership of <strong>{resource.name}</strong> will transfer to{" "}
                  <strong>{personName(preview.new_owner)}</strong>.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p className="text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmMutation.isPending}
              onClick={() => void confirm()}
            >
              <SavingChangesIcon
                aria-hidden="true"
                className={
                  confirmMutation.isPending
                    ? "motion-safe:animate-spin"
                    : "invisible"
                }
                data-icon="inline-start"
              />
              Confirm transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function personName(person: WorkspaceOwnershipTransfer["new_owner"]) {
  return (
    [person.first_name, person.last_name].filter(Boolean).join(" ") ||
    person.username ||
    person.unique_id
  )
}

function resourceListKey(
  kind: WorkspaceResourceDetail["kind"],
  scope: IdentityScope
) {
  if (kind === "sample") return crucibleKeys.sampleLists(scope)
  if (kind === "dataset") return crucibleKeys.datasetLists(scope)
  if (kind === "instrument") return crucibleKeys.instrumentLists(scope)
  return crucibleKeys.projectLists(scope)
}

function operationError(error: unknown, action: string) {
  if (error instanceof HubApiClientError) return error.message
  return `Could not ${action}. Try again.`
}
