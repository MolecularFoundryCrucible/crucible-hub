import { useId, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import {
  AddMemberIcon,
  ManageAccessIcon,
  RemoveMemberIcon,
  SavingChangesIcon,
} from "@/components/crucible/icons"
import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
import { personDisplayName } from "@/components/crucible/person-identity"
import { PersonLink } from "@/components/crucible/person-link"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
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
    ? "The service account could not be added."
    : "The service account could not be removed."
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
        <CardHeader>
          <CardTitle>Access management</CardTitle>
          {canManage ? (
            <CardAction>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={
                        managing
                          ? "Finish managing operators"
                          : "Manage operators"
                      }
                      aria-pressed={managing}
                      disabled={mutationPending}
                      onClick={() => setManaging((current) => !current)}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                    />
                  }
                >
                  <ManageAccessIcon aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>
                  {managing ? "Finish managing operators" : "Manage operators"}
                </TooltipContent>
              </Tooltip>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <h3 className="font-heading text-label">Operators</h3>
          <p className="mb-3 text-body text-muted-foreground">
            Service accounts collect data on behalf of this instrument.
          </p>
          {!canManage ? (
            <p className="text-body text-muted-foreground">
              Operator management is not available for this instrument.
            </p>
          ) : operatorsQuery.isPending ? (
            <p className="text-body text-muted-foreground" role="status">
              Loading operators…
            </p>
          ) : operatorsQuery.isError ? (
            <p className="text-body text-destructive" role="alert">
              Operators could not be loaded.
            </p>
          ) : operators.length === 0 ? (
            <p className="text-body text-muted-foreground">
              No service accounts are currently assigned.
            </p>
          ) : (
            <ul
              aria-label="Instrument operators"
              className="flex flex-col gap-3"
            >
              {operators.map((operator) => {
                const pending =
                  removeMutation.isPending &&
                  removeMutation.variables === operator.unique_id
                return (
                  <li
                    className="flex min-w-0 items-center gap-3"
                    key={operator.unique_id}
                  >
                    <PrincipalTypeIcon type="service_account" />
                    <PersonLink
                      className="flex-1"
                      person={{ ...operator, is_service_account: true }}
                      presentation="stacked"
                    />
                    <span className="inline-flex size-4 shrink-0 items-center justify-center">
                      {pending ? (
                        <SavingChangesIcon
                          aria-label={`Removing ${operatorName(operator)}`}
                          className="motion-safe:animate-spin"
                        />
                      ) : null}
                    </span>
                    {managing ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              aria-label={`Remove ${operatorName(operator)}`}
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
                        <TooltipContent>Remove operator</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
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
        confirmLabel="Remove operator"
        description={
          removingOperator
            ? `${operatorName(removingOperator)} will no longer collect data for this instrument.`
            : null
        }
        error={removingOperator ? error : undefined}
        onOpenChange={(open) => {
          if (!open && !removeMutation.isPending) setRemovingOperator(undefined)
        }}
        onConfirm={() => void removeOperator()}
        open={Boolean(removingOperator)}
        pending={removeMutation.isPending}
        title="Remove operator?"
        variant="destructive"
      />
    </>
  )
}
