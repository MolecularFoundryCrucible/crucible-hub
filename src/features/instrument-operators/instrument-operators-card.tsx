import { useEffect, useId, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { AccessGrantRow } from "@/components/crucible/access-grant-row"
import { useAccessListManagement } from "@/components/crucible/access-list-management"
import { AccessManagementToggle } from "@/components/crucible/access-management-toggle"
import {
  AccessRoleBadge,
  accessRoleLabel,
  isAccessGrantRole,
  permittedAccessGrantRoles,
  sortAccessGrants,
} from "@/components/crucible/access-role-badge"
import { AddMembersDialog } from "@/components/crucible/add-members-dialog"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { RemoveMembersDialog } from "@/components/crucible/remove-members-dialog"
import type { RemovableMember } from "@/components/crucible/remove-members-dialog"
import {
  AccessPendingIcon,
  AddMemberIcon,
  RemoveMemberIcon,
  SavingChangesIcon,
} from "@/components/crucible/icons"
import { personDisplayName } from "@/components/crucible/person-identity"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceName } from "@/components/crucible/resource-name"
import { ResourceSearchCombobox } from "@/components/crucible/resource-search-combobox"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  revokeWorkspaceResourceAccess,
  setWorkspaceResourceAccess,
} from "@/data/crucible/access.functions"
import { resourceAccessQueryOptions } from "@/data/crucible/access.queries"
import {
  addWorkspaceInstrumentOperator,
  removeWorkspaceInstrumentOperator,
} from "@/data/crucible/instruments.functions"
import { instrumentOperatorsQueryOptions } from "@/data/crucible/instruments.queries"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import {
  grantKey,
  grantName,
  principalKindFor,
} from "@/data/crucible/resource-access"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceInstrumentOperator,
  WorkspaceResourceAccessGrant,
  WorkspaceResourceAccessPrincipalKind,
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

type InstrumentDetail = Extract<WorkspaceResourceDetail, { kind: "instrument" }>
type GrantRole = "viewer" | "contributor" | "editor" | "admin"
type PrincipalKind = WorkspaceResourceAccessPrincipalKind

function operatorName(
  operator: Pick<
    WorkspaceInstrumentOperator,
    "first_name" | "last_name" | "unique_id" | "username"
  >
) {
  return personDisplayName(operator)
}

export function InstrumentAccessCard({
  instrument,
  scope,
}: {
  instrument: InstrumentDetail
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const canManage = instrument.capabilities?.can_manage_access === true
  const roles = permittedAccessGrantRoles(
    instrument.capabilities?.max_grant_role
  )
  const canGrant = canManage && roles.length > 0
  const scenario = fixtureScenarioFromScope(scope)

  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addOperatorOpen, setAddOperatorOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [removingOperator, setRemovingOperator] =
    useState<WorkspaceInstrumentOperator>()
  const [error, setError] = useState<string>()
  const {
    managing,
    setManaging,
    savingAnything,
    selection: selectedForRevoke,
    isSaving,
    stageOne,
    startSaving,
    stopSaving,
    toggleSelection,
  } = useAccessListManagement()

  const grantsQuery = useQuery({
    ...resourceAccessQueryOptions(scope, instrument.unique_id),
    enabled: canManage,
  })

  const operatorsQuery = useQuery({
    ...instrumentOperatorsQueryOptions(scope, instrument.unique_id),
    enabled: canManage,
  })

  const addOperatorMutation = useMutation({
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

  const removeOperatorMutation = useMutation({
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
  const mutationPending =
    savingAnything ||
    addOperatorMutation.isPending ||
    removeOperatorMutation.isPending

  const directGrants = useMemo(() => {
    if (canManage && grantsQuery.isLoading) return []
    const loaded = (grantsQuery.data ?? []).filter(
      (grant) => grant.principal_type !== "public"
    )
    if (
      instrument.owner &&
      !loaded.some(
        (grant) => grant.principal_id === instrument.owner?.unique_id
      )
    ) {
      return sortAccessGrants([
        {
          display_name:
            `${instrument.owner.first_name} ${instrument.owner.last_name}`.trim(),
          permission: "owner",
          principal_id: instrument.owner.unique_id,
          principal_type: "user",
          slug: instrument.owner.username,
        },
        ...loaded,
      ])
    }
    return sortAccessGrants(loaded)
  }, [canManage, grantsQuery.data, grantsQuery.isLoading, instrument.owner])

  const selectedGrants = directGrants.filter((grant) =>
    selectedForRevoke.has(grantKey(grant))
  )
  const removableSelection: readonly RemovableMember[] = selectedGrants.map(
    (grant) => ({ id: grantKey(grant), label: grantName(grant) })
  )

  function replaceGrants(nextGrants: readonly WorkspaceResourceAccessGrant[]) {
    queryClient.setQueryData(
      resourceAccessQueryOptions(scope, instrument.unique_id).queryKey,
      nextGrants
    )
  }

  function replaceOperators(nextOperators: WorkspaceInstrumentOperator[]) {
    queryClient.setQueryData(
      instrumentOperatorsQueryOptions(scope, instrument.unique_id).queryKey,
      nextOperators
    )
  }

  async function commitGrant(
    kind: PrincipalKind,
    principalId: string,
    role: GrantRole
  ): Promise<readonly WorkspaceResourceAccessGrant[]> {
    const nextGrants = unwrapHubResult(
      await setWorkspaceResourceAccess({
        data: {
          kind,
          permission: role,
          principal: principalId,
          resourceMfid: instrument.unique_id,
          scenario,
        },
      })
    )
    replaceGrants(nextGrants)
    return nextGrants
  }

  async function handleSetGrant(
    grant: WorkspaceResourceAccessGrant,
    role: GrantRole
  ) {
    const kind = principalKindFor(grant)
    if (!kind) return
    startSaving(grantKey(grant))
    setError(undefined)
    try {
      await commitGrant(kind, grant.principal_id, role)
    } catch (mutationError) {
      setError(
        hubErrorMessage(
          mutationError,
          "Could not update this access grant. Try again."
        )
      )
    } finally {
      stopSaving()
    }
  }

  async function commitRevoke(key: string) {
    const grant = directGrants.find((candidate) => grantKey(candidate) === key)
    if (!grant) {
      toggleSelection(key, false)
      return
    }
    const kind = principalKindFor(grant)
    if (!kind) return
    replaceGrants(
      unwrapHubResult(
        await revokeWorkspaceResourceAccess({
          data: {
            kind,
            principal: grant.principal_id,
            resourceMfid: instrument.unique_id,
            scenario,
          },
        })
      )
    )
    toggleSelection(key, false)
  }

  async function handleAddOperator(serviceAccountId: string) {
    setError(undefined)
    try {
      const nextOperators =
        await addOperatorMutation.mutateAsync(serviceAccountId)
      replaceOperators(nextOperators)
      return true
    } catch {
      setError("The service account could not be assigned.")
      return false
    }
  }

  async function handleRemoveOperator() {
    if (!removingOperator) return
    setError(undefined)
    try {
      const nextOperators = await removeOperatorMutation.mutateAsync(
        removingOperator.unique_id
      )
      replaceOperators(nextOperators)
      setRemovingOperator(undefined)
    } catch {
      setError("The service account could not be unassigned.")
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
                subject="access"
              />
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <h3 className="font-heading text-label">Direct access</h3>
          {managing ? (
            <p className="mb-3 text-body text-muted-foreground" role="status">
              Role changes save automatically.
            </p>
          ) : (
            <p className="mb-3 text-body text-muted-foreground">
              Direct access grants for people and projects.
            </p>
          )}

          {directGrants.length > 0 ? (
            <ul
              aria-label="Instrument direct access"
              className="flex flex-col gap-3"
            >
              {directGrants.map((grant) => {
                const isOwner =
                  grant.permission === "owner" ||
                  grant.principal_id === instrument.owner?.unique_id
                const kind = principalKindFor(grant)
                const editable =
                  managing &&
                  !isOwner &&
                  canGrant &&
                  kind !== undefined &&
                  isAccessGrantRole(grant.permission) &&
                  roles.includes(grant.permission)
                const revocable =
                  managing && !isOwner && kind !== undefined && canGrant
                const revokeBlockedReason = isOwner
                  ? "The manager cannot be revoked here"
                  : kind === undefined
                    ? "This grant is read-only"
                    : "This member cannot be revoked here"

                return (
                  <AccessGrantRow
                    identity={
                      grant.principal_type === "project" ? (
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <Link
                              className="truncate text-label hover:underline"
                              params={{ projectMfid: grant.principal_id }}
                              search={{ preview: undefined }}
                              state={{}}
                              to="/projects/$projectMfid"
                            >
                              {grantName(grant)}
                            </Link>
                            <p className="flex min-w-0 items-center gap-1.5 text-body text-muted-foreground">
                              <PrincipalTypeIcon
                                label="Project"
                                type="project"
                              />
                              <span className="truncate">
                                {grant.slug ?? grant.principal_id}
                              </span>
                            </p>
                          </div>
                        </div>
                      ) : (
                        <PersonLink
                          className="flex-1"
                          person={
                            isOwner && instrument.owner
                              ? instrument.owner
                              : {
                                  is_service_account: false,
                                  name: grant.display_name,
                                  unique_id: grant.principal_id,
                                  username: grant.slug,
                                }
                          }
                          presentation="avatar"
                        />
                      )
                    }
                    key={grantKey(grant)}
                    lockedReason={revokeBlockedReason}
                    managing={managing}
                    mutationPending={mutationPending}
                    onRevoke={() => {
                      stageOne(grantKey(grant))
                      setRemoveDialogOpen(true)
                    }}
                    pending={isSaving(grantKey(grant))}
                    pendingAriaLabel={`Saving access for ${grantName(grant)}`}
                    PendingIcon={AccessPendingIcon}
                    revocable={revocable}
                    revokeAriaLabel={`Revoke access for ${grantName(grant)}`}
                    revokeTooltipLabel="Revoke access"
                    roleBadge={
                      <AccessRoleBadge
                        label={isOwner ? "Manager" : undefined}
                        role={grant.permission}
                      />
                    }
                    roleEditor={
                      editable ? (
                        <NativeSelect
                          aria-label={`Role for ${grantName(grant)}`}
                          className="w-full sm:w-fit"
                          disabled={mutationPending}
                          onChange={(event) => {
                            if (isAccessGrantRole(event.target.value)) {
                              void handleSetGrant(grant, event.target.value)
                            }
                          }}
                          size="sm"
                          value={grant.permission}
                        >
                          {roles.map((role) => (
                            <NativeSelectOption key={role} value={role}>
                              {accessRoleLabel(role)}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : undefined
                    }
                    selectable={revocable}
                    selected={selectedForRevoke.has(grantKey(grant))}
                    selectionLabel={`Select ${grantName(grant)} for revocation`}
                    onSelectionChange={(checked) =>
                      toggleSelection(grantKey(grant), checked)
                    }
                  />
                )
              })}
            </ul>
          ) : !canManage ? (
            <p className="text-body text-muted-foreground">
              Direct access details are not available.
            </p>
          ) : grantsQuery.isPending ? (
            <p className="mt-3 text-body text-muted-foreground" role="status">
              Loading access grants…
            </p>
          ) : grantsQuery.isError ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="text-body text-destructive" role="alert">
                Access grants could not be loaded.
              </p>
              <Button
                onClick={() => void grantsQuery.refetch()}
                size="sm"
                type="button"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-body text-muted-foreground">
              No direct access grants are recorded.
            </p>
          )}

          {canGrant ? (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {removableSelection.length > 0 ? (
                <Button
                  disabled={mutationPending}
                  onClick={() => setRemoveDialogOpen(true)}
                  type="button"
                  variant="destructive"
                >
                  <RemoveMemberIcon data-icon="inline-start" />
                  {removableSelection.length > 1
                    ? `Revoke access for ${removableSelection.length} members`
                    : "Revoke access"}
                </Button>
              ) : null}
              <Button
                className="max-sm:w-full"
                disabled={mutationPending}
                onClick={() => {
                  setError(undefined)
                  setAddMemberOpen(true)
                }}
                type="button"
              >
                <AddMemberIcon data-icon="inline-start" />
                Add member
              </Button>
            </div>
          ) : null}

          <div className="mt-6 border-t pt-4">
            <h3 className="font-heading text-label">Operators</h3>
            <p className="mb-3 text-body text-muted-foreground">
              Operators are service accounts assigned to this instrument.
            </p>

            {operators.length > 0 ? (
              <ul
                aria-label="Instrument operators"
                className="flex flex-col gap-3"
              >
                {operators.map((operator) => {
                  const pending =
                    removeOperatorMutation.isPending &&
                    removeOperatorMutation.variables === operator.unique_id
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
            ) : !canManage ? (
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
            ) : (
              <p className="mt-3 text-body text-muted-foreground">
                No service accounts are currently assigned.
              </p>
            )}

            {canManage ? (
              <div className="mt-4 flex justify-end">
                <Button
                  className="max-sm:w-full"
                  disabled={mutationPending}
                  onClick={() => {
                    setError(undefined)
                    setAddOperatorOpen(true)
                  }}
                  type="button"
                >
                  <AddMemberIcon data-icon="inline-start" />
                  Add operator
                </Button>
              </div>
            ) : null}
          </div>

          {error && !addMemberOpen && !addOperatorOpen ? (
            <p className="mt-4 text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <AddMembersDialog
        disabled={mutationPending}
        excludeServiceAccounts
        existingIds={(kind) =>
          directGrants
            .filter((grant) => principalKindFor(grant) === kind)
            .map((grant) => grant.principal_id)
        }
        onAdd={commitGrant}
        onOpenChange={setAddMemberOpen}
        open={addMemberOpen}
        principalKinds={["users", "projects"]}
        resourceName={instrument.name}
        roleLabel="Access role"
        roles={roles}
        scope={scope}
        title="Add direct access"
      />

      <RemoveMembersDialog
        confirmLabel={(count) =>
          count > 1 ? `Revoke access for ${count} members` : "Revoke access"
        }
        description={
          removableSelection.length > 1 ? (
            <>
              These {removableSelection.length} members will no longer have
              direct access to <ResourceName>{instrument.name}</ResourceName>.
            </>
          ) : removableSelection[0] ? (
            <>
              <ResourceName>{removableSelection[0].label}</ResourceName> will no
              longer have direct access to{" "}
              <ResourceName>{instrument.name}</ResourceName>.
            </>
          ) : null
        }
        disabled={mutationPending}
        errorLabel={(count) =>
          count === 1
            ? "1 member could not be revoked. Try again."
            : `${count} members could not be revoked. Try again.`
        }
        members={removableSelection}
        onOpenChange={setRemoveDialogOpen}
        onRemove={commitRevoke}
        open={removeDialogOpen}
        title="Revoke access?"
      />

      <AddOperatorDialog
        disabled={mutationPending}
        excludedIds={operators.map((operator) => operator.unique_id)}
        onAdd={handleAddOperator}
        onOpenChange={setAddOperatorOpen}
        open={addOperatorOpen}
        scope={scope}
      />

      <ConfirmationDialog
        kind="alert"
        confirmLabel="Unassign operator"
        description={
          removingOperator
            ? `${operatorName(removingOperator)} will lose operator access to this instrument.`
            : null
        }
        error={removingOperator ? error : undefined}
        onOpenChange={(open) => {
          if (!open && !removeOperatorMutation.isPending) {
            setRemovingOperator(undefined)
          }
        }}
        onConfirm={() => void handleRemoveOperator()}
        open={Boolean(removingOperator)}
        pending={removeOperatorMutation.isPending}
        title="Unassign operator?"
        variant="destructive"
      />
    </>
  )
}

export const InstrumentOperatorsCard = InstrumentAccessCard

function AddOperatorDialog({
  disabled,
  excludedIds,
  onAdd,
  onOpenChange,
  open,
  scope,
}: {
  disabled: boolean
  excludedIds: readonly string[]
  onAdd: (serviceAccountId: string) => Promise<boolean>
  onOpenChange: (open: boolean) => void
  open: boolean
  scope: IdentityScope
}) {
  const searchInputId = useId()
  const [query, setQuery] = useState("")
  const [candidate, setCandidate] = useState<WorkspaceSearchResult>()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()

  useEffect(() => {
    if (!open) {
      setQuery("")
      setCandidate(undefined)
      setSubmitError(undefined)
      setSubmitting(false)
    }
  }, [open])

  async function handleAdd() {
    if (!candidate) return
    setSubmitting(true)
    setSubmitError(undefined)
    try {
      const ok = await onAdd(candidate.unique_id)
      if (ok) {
        onOpenChange(false)
      } else {
        setSubmitError("The service account could not be assigned.")
      }
    } catch (err) {
      setSubmitError(
        hubErrorMessage(err, "The service account could not be assigned.")
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange(nextOpen)
      }}
      open={open}
    >
      <DialogContent showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle>Add operator</DialogTitle>
        </DialogHeader>
        <ResourceSearchCombobox
          disabled={disabled || submitting}
          excludedIds={excludedIds}
          id={searchInputId}
          kind="person"
          onQueryChange={(nextQuery) => {
            setQuery(nextQuery)
            setSubmitError(undefined)
          }}
          onValueChange={(item) => {
            setCandidate(item)
            if (item) setQuery(item.name)
          }}
          query={query}
          scope={scope}
          serviceAccountsOnly
          value={candidate}
        />
        {submitError ? (
          <p className="mt-4 text-body text-destructive" role="alert">
            {submitError}
          </p>
        ) : null}
        <DialogFooter className="mt-6">
          <Button
            disabled={disabled || submitting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!candidate || disabled || submitting}
            onClick={() => void handleAdd()}
            type="button"
          >
            {submitting ? (
              <SavingChangesIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
                data-icon="inline-start"
              />
            ) : null}
            Add operator
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
