import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  InstrumentStatusPendingIcon,
  UpdateInstrumentStatusIcon,
} from "@/components/crucible/icons"
import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
import { InstrumentStatusBadge } from "@/components/crucible/instrument-status-badge"
import { ManagementAction } from "@/components/crucible/management-action"
import { Button } from "@/components/ui/button"
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
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
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
    } catch (cause) {
      setError(
        cause instanceof HubApiClientError
          ? cause.message
          : "The instrument status could not be changed. Your selection is still here."
      )
    }
  }

  const submit = () => {
    if (!selectedStatus || selectedStatus === instrument.status) return
    if (selectedStatus === "decommissioned") {
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
          <Button
            disabled={
              pending || !selectedStatus || selectedStatus === instrument.status
            }
            form={`instrument-lifecycle-${instrument.unique_id}`}
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
        }
        busy={pending}
        description="Review and update whether this instrument is active, under maintenance, or decommissioned."
        presentation={presentation}
        title="Lifecycle"
      >
        <div className="flex flex-col gap-6">
          <dl>
            <div>
              <dt className="text-label text-muted-foreground">
                Current status
              </dt>
              <dd className="mt-1">
                {instrument.status ? (
                  <InstrumentStatusBadge status={instrument.status} />
                ) : (
                  currentLabel
                )}
              </dd>
            </div>
          </dl>
          <form
            id={`instrument-lifecycle-${instrument.unique_id}`}
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <fieldset disabled={pending}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="instrument-status">Status</FieldLabel>
                  <NativeSelect
                    className="w-full"
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
              </FieldGroup>
            </fieldset>
            {error ? (
              <p className="mt-4 text-body text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </div>
      </ManagementAction>

      <ConfirmationAlertDialog
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
