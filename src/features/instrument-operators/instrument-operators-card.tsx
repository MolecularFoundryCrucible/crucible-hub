import { useId, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { AccessManagementToggle } from "@/components/crucible/access-management-toggle"
import { AccessRoleBadge } from "@/components/crucible/access-role-badge"
import {
  AddMemberIcon,
  RemoveMemberIcon,
  SavingChangesIcon,
} from "@/components/crucible/icons"
import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
import { personDisplayName } from "@/components/crucible/person-identity"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceSearchCombobox } from "@/components/crucible/resource-search-combobox"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  addWorkspaceInstrumentOperator,
  removeWorkspaceInstrumentOperator,
} from "@/data/crucible/instruments.functions"
import { instrumentOperatorsQueryOptions } from "@/data/crucible/instruments.queries"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceInstrumentOperator,
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

type InstrumentDetail = Extract<WorkspaceResourceDetail, { kind: "instrument" }>
type OperatorProfile = Pick<
  WorkspaceInstrumentOperator,
  "first_name" | "last_name" | "unique_id" | "username"
>

function operatorName(operator: OperatorProfile) {
  return personDisplayName(operator)
}

function actionErrorMessage(action: "add" | "remove") {
  return action === "add"
    ? "The service account could not be assigned."
    : "The service account could not be unassigned."
}

export function InstrumentOperatorsCard({
  instrument,
  scope,
}: {
  instrument: InstrumentDetail
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const searchInputId = useId()
  const canManage = instrument.capabilities?.can_manage_access === true
  const [managing, setManaging] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [candidate, setCandidate] = useState<WorkspaceSearchResult>()
  const [removingOperator, setRemovingOperator] =
    useState<WorkspaceInstrumentOperator>()
  const [error, setError] = useState<string>()
  const scenario = fixtureScenarioFromScope(scope)

  const operatorsQuery = useQuery({
    ...instrumentOperatorsQueryOptions(scope, instrument.unique_id),
    enabled: canManage,
  })
  const addMutation = useMutation({
    mutationFn: async (serviceAccountId: string) =>
      unwrapHubResult(
        await addWorkspaceInstrumentOperator({
          data: {
            instrumentMfid: instrument.unique_id,
            serviceAccountId,
            scenario,
          },
        })
      ),
  })
  const removeMutation = useMutation({
    mutationFn: async (serviceAccountId: string) =>
      unwrapHubResult(
        await removeWorkspaceInstrumentOperator({
          data: {
            instrumentMfid: instrument.unique_id,
            serviceAccountId,
            scenario,
          },
        })
      ),
  })

  const operators = operatorsQuery.data ?? []
  const mutationPending = addMutation.isPending || removeMutation.isPending

  function replaceOperators(nextOperators: WorkspaceInstrumentOperator[]) {
    queryClient.setQueryData(
      instrumentOperatorsQueryOptions(scope, instrument.unique_id).queryKey,
      nextOperators
    )
  }

  function openAddDialog(open: boolean) {
    if (!open && mutationPending) return
    setAddOpen(open)
    if (!open) {
      setQuery("")
      setCandidate(undefined)
      setError(undefined)
    }
  }

  function resetAddDialog() {
    setAddOpen(false)
    setQuery("")
    setCandidate(undefined)
    setError(undefined)
  }

  async function addOperator() {
    if (!canManage || !candidate || mutationPending) return
    setError(undefined)
    try {
      const nextOperators = await addMutation.mutateAsync(candidate.unique_id)
      replaceOperators(nextOperators)
      resetAddDialog()
    } catch {
      setError(actionErrorMessage("add"))
    }
  }

  async function removeOperator() {
    if (!canManage || !removingOperator || mutationPending) return
    setError(undefined)
    try {
      const nextOperators = await removeMutation.mutateAsync(
        removingOperator.unique_id
      )
      replaceOperators(nextOperators)
      setRemovingOperator(undefined)
    } catch {
      setError(actionErrorMessage("remove"))
    }
  }

  return (
    <>
      <Card>
        <CardHeader actionLayout="inline">
          <CardTitle>Access management</CardTitle>
          {canManage ? (
            <CardAction>
              <AccessManagementToggle
                active={managing}
                disabled={mutationPending}
                onChange={setManaging}
                subject="operators"
              />
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <h3 className="font-heading text-label">Direct access</h3>
          <p className="mb-3 text-body text-muted-foreground">
            Operators are service accounts assigned to this instrument.
          </p>
          <ul
            aria-label="Instrument direct access"
            className="flex flex-col gap-3"
          >
            {instrument.owner ? (
              <li className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
                <PersonLink
                  className="flex-1"
                  person={instrument.owner}
                  presentation="avatar"
                />
                <div className="flex min-h-8 w-full items-center justify-end sm:w-auto sm:shrink-0">
                  <AccessRoleBadge label="Manager" role="owner" />
                </div>
              </li>
            ) : (
              <li className="text-body text-muted-foreground">
                Manager details are unavailable.
              </li>
            )}
            {operators.map((operator) => {
              const pending =
                removeMutation.isPending &&
                removeMutation.variables === operator.unique_id
              return (
                <li
                  className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3"
                  key={operator.unique_id}
                >
                  <PersonLink
                    className="flex-1"
                    person={{ ...operator, is_service_account: true }}
                    presentation="avatar"
                  />
                  <div className="flex min-h-8 w-full items-center justify-end gap-2 sm:w-auto sm:shrink-0">
                    {pending ? (
                      <SavingChangesIcon
                        aria-label={`Unassigning ${operatorName(operator)}`}
                        className="motion-safe:animate-spin"
                      />
                    ) : null}
                    <AccessRoleBadge label="Operator" role="editor" />
                    {managing ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              aria-label={`Unassign ${operatorName(operator)}`}
                              disabled={mutationPending}
                              onClick={() => {
                                setError(undefined)
                                setRemovingOperator(operator)
                              }}
                              size="icon-sm"
                              type="button"
                              variant="destructive"
                            />
                          }
                        >
                          <RemoveMemberIcon aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>Unassign operator</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
          {!canManage ? (
            <p className="text-body text-muted-foreground">
              Operator management is not available for this instrument.
            </p>
          ) : operatorsQuery.isPending ? (
            <p className="mt-3 text-body text-muted-foreground" role="status">
              Loading operators…
            </p>
          ) : operatorsQuery.isError ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="text-body text-destructive" role="alert">
                Operators could not be loaded.
              </p>
              <Button
                onClick={() => void operatorsQuery.refetch()}
                size="sm"
                type="button"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : operators.length === 0 ? (
            <p className="mt-3 text-body text-muted-foreground">
              No service accounts are currently assigned.
            </p>
          ) : null}
          {error && !addOpen && !removingOperator ? (
            <p className="mt-4 text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {canManage ? (
            <div className="mt-4 flex justify-end">
              <Button
                className="max-sm:w-full"
                disabled={mutationPending}
                onClick={() => {
                  setError(undefined)
                  openAddDialog(true)
                }}
                type="button"
              >
                <AddMemberIcon data-icon="inline-start" />
                Add operator
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog onOpenChange={openAddDialog} open={addOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add operator</DialogTitle>
          </DialogHeader>
          <ResourceSearchCombobox
            disabled={mutationPending}
            excludedIds={operators.map((operator) => operator.unique_id)}
            id={searchInputId}
            kind="person"
            onQueryChange={(nextQuery) => {
              setQuery(nextQuery)
              setError(undefined)
            }}
            onValueChange={setCandidate}
            query={query}
            scope={scope}
            serviceAccountsOnly
            value={candidate}
          />
          <div>
            {error && addOpen ? (
              <p className="mt-4 text-body text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter className="mt-6">
              <Button
                disabled={mutationPending}
                onClick={() => openAddDialog(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={!candidate || mutationPending}
                onClick={() => void addOperator()}
                type="button"
              >
                {addMutation.isPending ? (
                  <SavingChangesIcon
                    aria-hidden="true"
                    className="motion-safe:animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                Add operator
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationAlertDialog
        confirmLabel="Unassign operator"
        description={
          removingOperator
            ? `${operatorName(removingOperator)} will lose operator access to this instrument.`
            : null
        }
        error={removingOperator ? error : undefined}
        onOpenChange={(open) => {
          if (!open && !removeMutation.isPending) setRemovingOperator(undefined)
        }}
        onConfirm={() => void removeOperator()}
        open={Boolean(removingOperator)}
        pending={removeMutation.isPending}
        title="Unassign operator?"
        variant="destructive"
      />
    </>
  )
}
