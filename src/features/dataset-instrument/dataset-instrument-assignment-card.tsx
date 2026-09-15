import { useId, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
import { ManagementAction } from "@/components/crucible/management-action"
import { ResourceSearchCombobox } from "@/components/crucible/resource-search-combobox"
import { useClearResourceSiblingNavigation } from "@/components/crucible/resource-sibling-navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { resourceAccessQueryOptions } from "@/data/crucible/access.queries"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { assignWorkspaceDatasetInstrument } from "@/data/crucible/resources.functions"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceDatasetInstrumentAssignment,
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

type DatasetResource = Extract<WorkspaceResourceDetail, { kind: "dataset" }>

export function DatasetInstrumentAssignmentCard({
  mode,
  presentation,
  resource,
  scope,
}: {
  mode: "api" | "fixture"
  presentation?: "card" | "row"
  resource: DatasetResource
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const clearResourceSiblingNavigation = useClearResourceSiblingNavigation()
  const searchInputId = useId()
  const [chooserOpen, setChooserOpen] = useState(false)
  const [instrumentQuery, setInstrumentQuery] = useState("")
  const [selectedInstrument, setSelectedInstrument] =
    useState<WorkspaceSearchResult>()
  const [error, setError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (instrumentMfid: string) =>
      unwrapHubResult(
        await assignWorkspaceDatasetInstrument({
          data: {
            datasetMfid: resource.unique_id,
            instrumentMfid,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })

  async function confirm() {
    if (!selectedInstrument) return
    setError(undefined)
    try {
      const result = await mutation.mutateAsync(selectedInstrument.unique_id)
      applyConfirmedInstrument(result)
      invalidateInstrumentQueries()
      clearResourceSiblingNavigation?.()
      setInstrumentQuery("")
      setSelectedInstrument(undefined)
    } catch (caught) {
      setError(operationError(caught))
    }
  }

  function applyConfirmedInstrument(
    result: WorkspaceDatasetInstrumentAssignment
  ) {
    queryClient.setQueryData<WorkspaceResourceDetail | null>(
      resourceQueryOptions(scope, resource.unique_id).queryKey,
      (current) =>
        current?.kind === "dataset"
          ? {
              ...current,
              instrument: result.instrument,
              instrument_id: result.instrument.instrument_id ?? null,
            }
          : current
    )
  }

  function invalidateInstrumentQueries() {
    if (mode !== "api") return
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: resourceQueryOptions(scope, resource.unique_id).queryKey,
    })
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: resourceAccessQueryOptions(scope, resource.unique_id).queryKey,
    })
    void queryClient.invalidateQueries({
      queryKey: crucibleKeys.datasetLists(scope),
    })
    void queryClient.invalidateQueries({
      queryKey: crucibleKeys.searches(scope),
    })
  }

  function closeChooser(nextOpen: boolean) {
    setChooserOpen(nextOpen)
    if (!nextOpen) setInstrumentQuery("")
  }

  if (resource.capabilities?.can_manage_access !== true) return null

  const currentInstrumentName =
    resource.instrument?.instrument_name ?? resource.instrument_id

  return (
    <>
      <ManagementAction
        action={
          <Button onClick={() => setChooserOpen(true)} type="button">
            Choose instrument
          </Button>
        }
        busy={mutation.isPending}
        description="Set the acquisition instrument and update its derived dataset access."
        presentation={presentation}
        title="Change instrument"
      />
      <Dialog onOpenChange={closeChooser} open={chooserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose an instrument</DialogTitle>
          </DialogHeader>
          <ResourceSearchCombobox
            disabled={mutation.isPending}
            excludedIds={
              resource.instrument?.unique_id
                ? [resource.instrument.unique_id]
                : []
            }
            id={searchInputId}
            kind="instrument"
            onQueryChange={setInstrumentQuery}
            onValueChange={(instrument) => {
              if (instrument?.kind !== "instrument") return
              setError(undefined)
              setSelectedInstrument(instrument)
              setChooserOpen(false)
            }}
            query={instrumentQuery}
            scope={scope}
            value={undefined}
          />
        </DialogContent>
      </Dialog>
      <ConfirmationAlertDialog
        confirmLabel="Change instrument"
        description={
          selectedInstrument ? (
            <>
              Set <strong>{selectedInstrument.name}</strong> as the acquisition
              instrument for <strong>{resource.name}</strong>
              {currentInstrumentName ? (
                <>
                  {" "}
                  in place of <strong>{currentInstrumentName}</strong>
                </>
              ) : null}
              . Its derived dataset access will be updated.
            </>
          ) : null
        }
        error={error}
        onConfirm={() => void confirm()}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setInstrumentQuery("")
            setSelectedInstrument(undefined)
            setError(undefined)
          }
        }}
        open={Boolean(selectedInstrument)}
        pending={mutation.isPending}
        pendingLabel="Changing instrument"
        title="Change acquisition instrument?"
      />
    </>
  )
}

function operationError(error: unknown) {
  if (error instanceof HubApiClientError) return error.message
  return "Could not change the acquisition instrument. Try again."
}
