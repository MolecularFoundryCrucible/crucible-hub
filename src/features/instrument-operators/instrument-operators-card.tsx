import { entryActions } from "@/data/crucible/entry-capabilities"
import { useId, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  AccessGrantListActions,
  AccessGrantRow,
} from "@/components/crucible/access-grant-row"
import { useAccessListManagement } from "@/components/crucible/access-list-management"
import { ManagementToggle } from "@/components/crucible/management-toggle"
import {
  AccessRoleBadge,
  accessRoleLabel,
  permittedAccessGrantRoles,
} from "@/components/crucible/access-role-badge"
import { AddMembersDialog } from "@/components/crucible/add-members-dialog"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { RemoveMembersDialog } from "@/components/crucible/remove-members-dialog"
import type { RemovableMember } from "@/components/crucible/remove-members-dialog"
import { RemoveMemberIcon } from "@/components/crucible/icons"
import { personDisplayName } from "@/components/crucible/person-identity"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceName } from "@/components/crucible/resource-name"
import { ResourceSearchCombobox } from "@/components/crucible/resource-search-combobox"
import { sortProjectMembers } from "@/components/crucible/project-members"
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
  addWorkspaceInstrumentMember,
  addWorkspaceInstrumentOperator,
  removeWorkspaceInstrumentMember,
  removeWorkspaceInstrumentOperator,
  updateWorkspaceInstrumentMemberRole,
} from "@/data/crucible/instruments.functions"
import {
  instrumentMembersQueryOptions,
  instrumentOperatorsQueryOptions,
} from "@/data/crucible/instruments.queries"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  hubErrorMessage,
  hubOperationError,
  unwrapHubResult,
} from "@/data/crucible/result"
import type {
  WorkspaceInstrumentMember,
  WorkspaceInstrumentMembershipRole,
  WorkspaceInstrumentOperator,
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"
import { InstrumentRoleBadge } from "@/features/instrument-people/instrument-people-card"
import { useExitSafeValue } from "@/hooks/use-exit-safe"

type InstrumentDetail = Extract<WorkspaceResourceDetail, { kind: "instrument" }>
type MemberRole = WorkspaceInstrumentMembershipRole

const memberRoleOrder: readonly MemberRole[] = ["viewer", "editor", "admin"]

function isMemberRole(role: string): role is MemberRole {
  return memberRoleOrder.some((candidate) => candidate === role)
}

function memberName(member: WorkspaceInstrumentMember) {
  return personDisplayName(member)
}

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
  const canView = canManage || instrument.capabilities?.can_view_access === true
  const roles = permittedAccessGrantRoles(
    instrument.capabilities?.max_grant_role
  ).filter(isMemberRole)
  const canGrant = canManage && roles.length > 0
  const scenario = fixtureScenarioFromScope(scope)

  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addOperatorOpen, setAddOperatorOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [removingOperator, setRemovingOperator] =
    useState<WorkspaceInstrumentOperator>()
  const removalExit = useExitSafeValue(removingOperator)
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

  const membersQuery = useQuery({
    ...instrumentMembersQueryOptions(scope, instrument.unique_id),
    enabled: canView,
  })

  const operatorsQuery = useQuery({
    ...instrumentOperatorsQueryOptions(scope, instrument.unique_id),
    enabled: canView,
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

  const members = useMemo(
    () => sortProjectMembers(membersQuery.data ?? []),
    [membersQuery.data]
  )

  const selectedMembers = members.filter((member) =>
    selectedForRevoke.has(member.unique_id)
  )
  const removableSelection: readonly RemovableMember[] = selectedMembers.map(
    (member) => ({ id: member.unique_id, label: memberName(member) })
  )

  function replaceMembers(nextMembers: WorkspaceInstrumentMember[]) {
    queryClient.setQueryData(
      instrumentMembersQueryOptions(scope, instrument.unique_id).queryKey,
      nextMembers
    )
  }

  function replaceOperators(nextOperators: WorkspaceInstrumentOperator[]) {
    queryClient.setQueryData(
      instrumentOperatorsQueryOptions(scope, instrument.unique_id).queryKey,
      nextOperators
    )
  }

  async function commitMember(
    _kind: unknown,
    userId: string,
    role: string
  ): Promise<void> {
    if (!isMemberRole(role)) return
    replaceMembers(
      unwrapHubResult(
        await addWorkspaceInstrumentMember({
          data: {
            instrumentMfid: instrument.unique_id,
            role,
            scenario,
            userId,
          },
        })
      )
    )
  }

  async function handleChangeRole(
    member: WorkspaceInstrumentMember,
    role: MemberRole
  ) {
    if (role === member.role) return
    startSaving(member.unique_id)
    setError(undefined)
    try {
      replaceMembers(
        unwrapHubResult(
          await updateWorkspaceInstrumentMemberRole({
            data: {
              instrumentMfid: instrument.unique_id,
              role,
              scenario,
              userId: member.unique_id,
            },
          })
        )
      )
    } catch (mutationError) {
      setError(hubOperationError(mutationError, "change this role"))
    } finally {
      stopSaving()
    }
  }

  async function commitRemoval(userId: string) {
    replaceMembers(
      unwrapHubResult(
        await removeWorkspaceInstrumentMember({
          data: { instrumentMfid: instrument.unique_id, scenario, userId },
        })
      )
    )
    toggleSelection(userId, false)
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
        <CardHeader>
          <CardTitle>Access management</CardTitle>
          {canManage ? (
            <CardAction>
              <ManagementToggle
                active={managing}
                disabled={mutationPending}
                onChange={setManaging}
                subject="access"
              />
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <h3
            className={
              managing
                ? "font-heading text-label"
                : "mb-3 font-heading text-label"
            }
          >
            Members
          </h3>
          {managing ? (
            <p className="mb-3 text-body text-muted-foreground" role="status">
              Role changes save automatically.
            </p>
          ) : null}

          {members.length > 0 ? (
            <ul aria-label="Instrument members" className="flex flex-col gap-3">
              {members.map((member) => {
                const actions = entryActions(
                  member.capabilities,
                  member.role,
                  memberRoleOrder
                )
                const editable = managing && actions.canChangeRole
                const removable = managing && actions.canRemove
                const removeBlockedReason =
                  member.role === "owner"
                    ? "The manager cannot be removed here"
                    : "Your role cannot remove this member"

                return (
                  <AccessGrantRow
                    identity={
                      <PersonLink
                        className="flex-1"
                        person={member}
                        presentation="avatar"
                      />
                    }
                    key={member.unique_id}
                    lockedReason={removeBlockedReason}
                    managing={managing}
                    mutationPending={mutationPending}
                    onRevoke={() => {
                      stageOne(member.unique_id)
                      setRemoveDialogOpen(true)
                    }}
                    pending={isSaving(member.unique_id)}
                    pendingAriaLabel={`Saving ${memberName(member)}'s membership`}
                    revocable={removable}
                    revokeAriaLabel={`Remove ${memberName(member)}`}
                    revokeTooltipLabel="Remove member"
                    roleBadge={<InstrumentRoleBadge role={member.role} />}
                    roleEditor={
                      editable ? (
                        <NativeSelect
                          aria-label={`Role for ${memberName(member)}`}
                          className="w-fit"
                          disabled={mutationPending}
                          onChange={(event) => {
                            if (isMemberRole(event.target.value)) {
                              void handleChangeRole(member, event.target.value)
                            }
                          }}
                          size="sm"
                          value={member.role}
                        >
                          {actions.roleOptions.map((role) => (
                            <NativeSelectOption key={role} value={role}>
                              {accessRoleLabel(role)}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : undefined
                    }
                    selectable={removable}
                    selected={selectedForRevoke.has(member.unique_id)}
                    selectionLabel={`Select ${memberName(member)} for removal`}
                    onSelectionChange={(checked) =>
                      toggleSelection(member.unique_id, checked)
                    }
                  />
                )
              })}
            </ul>
          ) : !canView || membersQuery.data === null ? (
            <p className="text-body text-muted-foreground">
              Membership details are not available.
            </p>
          ) : membersQuery.isPending ? (
            <p className="mt-3 text-body text-muted-foreground" role="status">
              Loading members…
            </p>
          ) : membersQuery.isError ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="text-body text-destructive" role="alert">
                Members could not be loaded.
              </p>
              <Button
                onClick={() => void membersQuery.refetch()}
                size="sm"
                type="button"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-body text-muted-foreground">
              No members are currently listed.
            </p>
          )}

          {canGrant ? (
            <AccessGrantListActions
              addLabel="Add member"
              disabled={mutationPending}
              managing={managing}
              onAdd={() => {
                setError(undefined)
                setAddMemberOpen(true)
              }}
              onRemove={() => setRemoveDialogOpen(true)}
              removeCount={removableSelection.length}
              removeMode="remove"
            />
          ) : null}

          <div className="mt-6 border-t pt-4">
            <h3 className="mb-3 font-heading text-label">Operators</h3>

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
                      className="flex min-w-0 items-center justify-between gap-2 sm:gap-3"
                      key={operator.unique_id}
                    >
                      <PersonLink
                        className="min-w-0 flex-1"
                        person={{ ...operator, is_service_account: true }}
                        presentation="avatar"
                      />
                      <div className="flex min-h-8 shrink-0 items-center justify-end gap-2">
                        {pending ? (
                          <PendingIcon
                            label={`Unassigning ${operatorName(operator)}`}
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
              <AccessGrantListActions
                addLabel="Add operator"
                disabled={mutationPending}
                managing={managing}
                onAdd={() => {
                  setError(undefined)
                  setAddOperatorOpen(true)
                }}
              />
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
        existingIds={() => members.map((member) => member.unique_id)}
        onAdd={commitMember}
        onOpenChange={setAddMemberOpen}
        open={addMemberOpen}
        principalKinds={["users"]}
        roles={roles}
        scope={scope}
        title="Add member"
      />

      <RemoveMembersDialog
        confirmLabel={(count) =>
          count > 1 ? `Remove ${count} members` : "Remove member"
        }
        description={
          removableSelection.length > 1 ? (
            <>
              These {removableSelection.length} members will no longer have
              access to <ResourceName>{instrument.name}</ResourceName>.
            </>
          ) : removableSelection[0] ? (
            <>
              <ResourceName>{removableSelection[0].label}</ResourceName> will no
              longer have access to{" "}
              <ResourceName>{instrument.name}</ResourceName>.
            </>
          ) : null
        }
        disabled={mutationPending}
        errorLabel={(count) =>
          count === 1
            ? "1 member could not be removed. Try again."
            : `${count} members could not be removed. Try again.`
        }
        members={removableSelection}
        onOpenChange={setRemoveDialogOpen}
        onRemove={commitRemoval}
        open={removeDialogOpen}
        title={
          removableSelection.length > 1 ? "Remove members?" : "Remove member?"
        }
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
          removalExit.value
            ? `${operatorName(removalExit.value)} will lose operator access to this instrument.`
            : null
        }
        error={removalExit.value ? error : undefined}
        onOpenChange={(open) => {
          if (!open && !removeOperatorMutation.isPending) {
            setRemovingOperator(undefined)
          }
        }}
        onOpenChangeComplete={removalExit.onOpenChangeComplete}
        onConfirm={() => void handleRemoveOperator()}
        open={Boolean(removingOperator)}
        pending={removeOperatorMutation.isPending}
        pendingLabel="Unassigning operator"
        title="Unassign operator?"
        variant="destructive"
      />
    </>
  )
}

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

  function resetAfterClose(isOpen: boolean) {
    if (isOpen) return
    setQuery("")
    setCandidate(undefined)
    setSubmitError(undefined)
    setSubmitting(false)
  }

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
      onOpenChangeComplete={resetAfterClose}
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
            {submitting ? <PendingIcon data-icon="inline-start" /> : null}
            Add operator
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
