import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import {
  InstrumentStatusPendingIcon,
  UpdateInstrumentStatusIcon,
} from "@/components/crucible/icons"
import { ResourceStatusBadge } from "@/components/crucible/resource-status-badge"
import { ManagementAction } from "@/components/crucible/management-action"
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import {
  instrumentStatusLabel,
  instrumentStatuses,
  isWorkspaceInstrumentStatus,
} from "@/data/crucible/instrument-status"
import { updateWorkspaceInstrumentStatus } from "@/data/crucible/instruments.functions"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceInstrument,
  WorkspaceInstrumentLifecycleUpdate,
  WorkspaceInstrumentPage,
  WorkspaceInstrumentStatus,
  WorkspaceResourceDetail,
} from "@/data/crucible/workspace-source"

type InstrumentDetail = Extract<WorkspaceResourceDetail, { kind: "instrument" }>

export function mergeInstrumentLifecycleUpdate(
  resource: WorkspaceResourceDetail | null | undefined,
  update: WorkspaceInstrumentLifecycleUpdate
): WorkspaceResourceDetail | null | undefined {
  if (!resource || resource.kind !== "instrument") return resource
  return {
    ...resource,
    modification_time: update.modification_time,
    status: update.status,
  }
}

function mergeInstrumentLifecycleListUpdate(
  page: WorkspaceInstrumentPage | undefined,
  update: WorkspaceInstrumentLifecycleUpdate
) {
  if (!page) return page
  return {
    ...page,
    items: page.items.map((instrument) =>
      instrument.unique_id === update.unique_id
        ? mergeInstrumentLifecycleListItem(instrument, update)
        : instrument
    ),
  }
}

function mergeInstrumentLifecycleListItem(
  instrument: WorkspaceInstrument,
  update: WorkspaceInstrumentLifecycleUpdate
): WorkspaceInstrument {
  return {
    ...instrument,
    modification_time: update.modification_time,
    status: update.status,
  }
}

function statusDescription(status: WorkspaceInstrumentStatus) {
  if (status === "active") return "Available for normal acquisition work."
  if (status === "maintenance") {
    return "Temporarily unavailable while maintenance is in progress."
  }
  return "Retired from future use while existing datasets remain available."
}

function initialStatus(instrument: InstrumentDetail) {
  return isWorkspaceInstrumentStatus(instrument.status)
    ? instrument.status
    : undefined
}

export function InstrumentLifecycleCard({
  instrument,
  mode,
  presentation,
  scope,
}: {
  instrument: InstrumentDetail
  mode: "api" | "fixture"
  presentation?: "card" | "row"
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<
    WorkspaceInstrumentStatus | undefined
  >(() => initialStatus(instrument))
  const [confirmingDecommission, setConfirmingDecommission] = useState(false)
  const [error, setError] = useState<string>()
  const mutation = useMutation({
    mutationFn: async (status: WorkspaceInstrumentStatus) =>
      unwrapHubResult(
        await updateWorkspaceInstrumentStatus({
          data: {
            instrumentMfid: instrument.unique_id,
            scenario: fixtureScenarioFromScope(scope),
            status,
          },
        })
      ),
  })

  const applyStatus = async (status: WorkspaceInstrumentStatus) => {
    setError(undefined)
    try {
      const update = await mutation.mutateAsync(status)
      const detailQuery = resourceQueryOptions(scope, instrument.unique_id)
      queryClient.setQueryData(detailQuery.queryKey, (current) =>
        mergeInstrumentLifecycleUpdate(current, update)
      )
      if (mode === "fixture") {
        queryClient.setQueriesData<WorkspaceInstrumentPage>(
          { queryKey: crucibleKeys.instrumentLists(scope) },
          (page) => mergeInstrumentLifecycleListUpdate(page, update)
        )
      } else {
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.instrumentLists(scope),
        })
        void queryClient.invalidateQueries({
          queryKey: crucibleKeys.searches(scope),
        })
      }
      setSelectedStatus(update.status)
      setConfirmingDecommission(false)
      setDialogOpen(false)
    } catch (cause) {
      setError(
        hubErrorMessage(
          cause,
          "The instrument status could not be changed. Your selection is still here."
        )
      )
    }
  }

  const openDialog = (nextOpen: boolean) => {
    if (mutation.isPending) return
    setDialogOpen(nextOpen)
    if (nextOpen) {
      setSelectedStatus(initialStatus(instrument))
    }
    setError(undefined)
  }

  const submit = () => {
    if (!selectedStatus || selectedStatus === instrument.status) return
    if (selectedStatus === "decommissioned") {
      setDialogOpen(false)
      setConfirmingDecommission(true)
      return
    }
    void applyStatus(selectedStatus)
  }

  const pending = mutation.isPending
  const currentLabel = instrument.status
    ? instrumentStatusLabel(instrument.status)
    : "Not recorded"

  return (
    <>
      <ManagementAction
        action={
          <Button onClick={() => openDialog(true)} type="button">
            Change status
          </Button>
        }
        busy={pending}
        description="Update whether this instrument is active, under maintenance, or decommissioned."
        presentation={presentation}
        title="Change status"
      >
        <div className="flex items-center gap-2 text-body">
          <span className="text-muted-foreground">Current status:</span>
          {instrument.status ? (
            <ResourceStatusBadge status={instrument.status} />
          ) : (
            currentLabel
          )}
        </div>
        {error && !dialogOpen && !confirmingDecommission ? (
          <p className="text-body text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </ManagementAction>

      <Dialog onOpenChange={openDialog} open={dialogOpen}>
        <DialogContent showCloseButton={!pending}>
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <DialogHeader>
              <DialogTitle>Change status</DialogTitle>
              <DialogDescription>
                Update whether this instrument is active, under maintenance, or
                decommissioned.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <div className="flex items-center gap-2 text-body">
                <span className="text-muted-foreground">Current status:</span>
                {instrument.status ? (
                  <ResourceStatusBadge status={instrument.status} />
                ) : (
                  currentLabel
                )}
              </div>
              <Field>
                <FieldLabel htmlFor="instrument-status">New status</FieldLabel>
                <NativeSelect
                  className="w-full"
                  disabled={pending}
                  id="instrument-status"
                  onChange={(event) => {
                    const status = event.target.value
                    if (isWorkspaceInstrumentStatus(status)) {
                      setSelectedStatus(status)
                      setError(undefined)
                    }
                  }}
                  value={selectedStatus ?? ""}
                >
                  {!selectedStatus ? (
                    <NativeSelectOption disabled value="">
                      Choose a status
                    </NativeSelectOption>
                  ) : null}
                  {instrumentStatuses.map((status) => (
                    <NativeSelectOption key={status} value={status}>
                      {instrumentStatusLabel(status)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {selectedStatus ? (
                  <FieldDescription>
                    {statusDescription(selectedStatus)}
                  </FieldDescription>
                ) : null}
              </Field>
              {error ? (
                <p className="text-body text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </FieldGroup>
            <DialogFooter>
              <Button
                disabled={pending}
                onClick={() => openDialog(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  pending ||
                  !selectedStatus ||
                  selectedStatus === instrument.status
                }
                type="submit"
              >
                {pending ? (
                  <InstrumentStatusPendingIcon
                    aria-hidden="true"
                    className="motion-safe:animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <UpdateInstrumentStatusIcon
                    aria-hidden="true"
                    data-icon="inline-start"
                  />
                )}
                Update status
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        kind="alert"
        confirmLabel="Decommission"
        description={
          <>
            <strong>{instrument.name}</strong> will be retired from future use.
            Existing datasets and instrument details will remain available.
          </>
        }
        error={error}
        onOpenChange={(open) => {
          if (pending) return
          setConfirmingDecommission(open)
          if (!open) {
            setError(undefined)
          }
        }}
        onConfirm={() => void applyStatus("decommissioned")}
        open={confirmingDecommission}
        pending={pending}
        title="Decommission instrument?"
        variant="destructive"
      />
    </>
  )
}
