import { useEffect, useId, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { AccessManagementToggle } from "@/components/crucible/access-management-toggle"
import {
  AccessRoleBadge,
  accessRoleLabel,
  accessRoleRank,
  isAccessGrantRole,
  permittedAccessGrantRoles,
} from "@/components/crucible/access-role-badge"
import { ConfirmationAlertDialog } from "@/components/crucible/confirmation-dialog"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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

const principalChoices: readonly {
  kind: PrincipalKind
  label: string
  searchKind: "person" | "project"
}[] = [
  { kind: "users", label: "Person", searchKind: "person" },
  { kind: "projects", label: "Project", searchKind: "project" },
]

function principalKindFor(
  grant: WorkspaceResourceAccessGrant
): PrincipalKind | undefined {
  if (grant.principal_type === "user") return "users"
  if (grant.principal_type === "project") return "projects"
  return undefined
}

function grantName(grant: WorkspaceResourceAccessGrant) {
  return grant.display_name ?? grant.slug ?? grant.principal_id
}

function grantKey(grant: WorkspaceResourceAccessGrant) {
  return `${grant.principal_type}:${grant.principal_id}`
}

function defaultGrantRole(roles: readonly GrantRole[]): GrantRole {
  return roles.at(-1) ?? "viewer"
}

function operatorName(
  operator: Pick<
    WorkspaceInstrumentOperator,
    "first_name" | "last_name" | "unique_id" | "username"
  >
) {
  return personDisplayName(operator)
}

function sortGrants(grants: readonly WorkspaceResourceAccessGrant[]) {
  return [...grants].sort((left, right) => {
    const roleDifference =
      accessRoleRank(left.permission) - accessRoleRank(right.permission)
    if (roleDifference !== 0) return roleDifference
    const nameDifference = grantName(left).localeCompare(grantName(right))
    if (nameDifference !== 0) return nameDifference
    return left.principal_id.localeCompare(right.principal_id)
  })
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

  const [managing, setManaging] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addOperatorOpen, setAddOperatorOpen] = useState(false)
  const [pendingMemberAction, setPendingMemberAction] = useState<string>()
  const [pendingRevoke, setPendingRevoke] =
    useState<WorkspaceResourceAccessGrant>()
  const [removingOperator, setRemovingOperator] =
    useState<WorkspaceInstrumentOperator>()
  const [error, setError] = useState<string>()

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
    pendingMemberAction !== undefined ||
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
      return sortGrants([
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
    return sortGrants(loaded)
  }, [canManage, grantsQuery.data, grantsQuery.isLoading, instrument.owner])

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

  async function handleSetGrant(
    kind: PrincipalKind,
    principalId: string,
    role: GrantRole
  ) {
    setPendingMemberAction(`set:${kind}:${principalId}`)
    setError(undefined)
    try {
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
      return true
    } catch (mutationError) {
      setError(
        hubErrorMessage(
          mutationError,
          "Could not update this access grant. Try again."
        )
      )
      return false
    } finally {
      setPendingMemberAction(undefined)
    }
  }

  async function handleRevokeGrant(grant: WorkspaceResourceAccessGrant) {
    const kind = principalKindFor(grant)
    if (!kind) return
    setPendingMemberAction(`revoke:${kind}:${grant.principal_id}`)
    setError(undefined)
    try {
      const nextGrants = unwrapHubResult(
        await revokeWorkspaceResourceAccess({
          data: {
            kind,
            principal: grant.principal_id,
            resourceMfid: instrument.unique_id,
            scenario,
          },
        })
      )
      replaceGrants(nextGrants)
      setPendingRevoke(undefined)
    } catch (mutationError) {
      setError(
        hubErrorMessage(
          mutationError,
          "Could not revoke this access grant. Try again."
        )
      )
    } finally {
      setPendingMemberAction(undefined)
    }
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
            <p
              className="mb-3 text-supporting text-muted-foreground"
              role="status"
            >
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
                const revocable = managing && !isOwner && kind !== undefined
                const pending =
                  pendingMemberAction ===
                  `set:${kind ?? ""}:${grant.principal_id}`

                return (
                  <li
                    className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3"
                    key={grantKey(grant)}
                  >
                    {grant.principal_type === "project" ? (
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
                            <PrincipalTypeIcon label="Project" type="project" />
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
                    )}

                    <div className="flex min-h-8 w-full items-center justify-end gap-2 sm:w-auto sm:shrink-0">
                      {pending ? (
                        <AccessPendingIcon
                          aria-label={`Saving access for ${grantName(grant)}`}
                          className="motion-safe:animate-spin"
                        />
                      ) : null}
                      <span className="flex min-w-0 flex-1 justify-end sm:w-access-role-control sm:flex-none">
                        {editable ? (
                          <NativeSelect
                            aria-label={`Role for ${grantName(grant)}`}
                            className="w-full sm:w-fit"
                            disabled={mutationPending}
                            onChange={(event) => {
                              if (isAccessGrantRole(event.target.value)) {
                                void handleSetGrant(
                                  kind,
                                  grant.principal_id,
                                  event.target.value
                                )
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
                        ) : (
                          <AccessRoleBadge
                            label={isOwner ? "Manager" : undefined}
                            role={grant.permission}
                          />
                        )}
                      </span>
                      {revocable ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                aria-label={`Revoke access for ${grantName(grant)}`}
                                disabled={mutationPending}
                                onClick={() => {
                                  setError(undefined)
                                  setPendingRevoke(grant)
                                }}
                                size="icon-sm"
                                type="button"
                                variant="destructive"
                              />
                            }
                          >
                            <RemoveMemberIcon aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>Revoke access</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </li>
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
            <div className="mt-4 flex justify-end">
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

          {error &&
          !addMemberOpen &&
          !addOperatorOpen &&
          !pendingRevoke &&
          !removingOperator ? (
            <p className="mt-4 text-body text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <AddMemberDialog
        disabled={mutationPending}
        existingGrants={directGrants}
        instrumentName={instrument.name}
        onAdd={handleSetGrant}
        onOpenChange={setAddMemberOpen}
        open={addMemberOpen}
        roles={roles}
        scope={scope}
      />

      <ConfirmationAlertDialog
        confirmLabel="Revoke access"
        description={
          pendingRevoke ? (
            <>
              <ResourceName>{grantName(pendingRevoke)}</ResourceName> will no
              longer have direct access to{" "}
              <ResourceName>{instrument.name}</ResourceName>.
            </>
          ) : null
        }
        error={pendingRevoke ? error : undefined}
        onOpenChange={(open) => {
          if (!open && pendingMemberAction === undefined) {
            setPendingRevoke(undefined)
          }
        }}
        onConfirm={() => {
          if (pendingRevoke) void handleRevokeGrant(pendingRevoke)
        }}
        open={pendingRevoke !== undefined}
        pending={pendingMemberAction !== undefined}
        title="Revoke access?"
        variant="destructive"
      />

      <AddOperatorDialog
        disabled={mutationPending}
        excludedIds={operators.map((operator) => operator.unique_id)}
        onAdd={handleAddOperator}
        onOpenChange={setAddOperatorOpen}
        open={addOperatorOpen}
        scope={scope}
      />

      <ConfirmationAlertDialog
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

function AddMemberDialog({
  disabled,
  existingGrants,
  instrumentName,
  onAdd,
  onOpenChange,
  open,
  roles,
  scope,
}: {
  disabled: boolean
  existingGrants: readonly WorkspaceResourceAccessGrant[]
  instrumentName: string
  onAdd: (
    kind: PrincipalKind,
    principalId: string,
    role: GrantRole
  ) => Promise<boolean>
  onOpenChange: (open: boolean) => void
  open: boolean
  roles: readonly GrantRole[]
  scope: IdentityScope
}) {
  const queryInputId = useId()
  const principalInputId = useId()
  const roleInputId = useId()
  const [principalIndex, setPrincipalIndex] = useState(0)
  const [query, setQuery] = useState("")
  const [role, setRole] = useState<GrantRole>(defaultGrantRole(roles))
  const [selected, setSelected] = useState<WorkspaceSearchResult>()
  const [validationError, setValidationError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()

  const choice = principalChoices[principalIndex] ?? principalChoices[0]
  const existing = existingGrants
    .filter((grant) => principalKindFor(grant) === choice.kind)
    .map((grant) => grant.principal_id)

  useEffect(() => {
    if (!open) {
      setPrincipalIndex(0)
      setQuery("")
      setRole(defaultGrantRole(roles))
      setSelected(undefined)
      setValidationError(undefined)
      setSubmitError(undefined)
      setSubmitting(false)
    }
  }, [open, roles])

  useEffect(() => {
    if (!roles.includes(role)) setRole(defaultGrantRole(roles))
  }, [role, roles])

  async function handleAdd() {
    if (!selected) {
      setValidationError("Choose a person or project.")
      return
    }
    setSubmitting(true)
    setSubmitError(undefined)
    try {
      const ok = await onAdd(choice.kind, selected.unique_id, role)
      if (ok) {
        onOpenChange(false)
      } else {
        setSubmitError("The access grant could not be added.")
      }
    } catch (err) {
      setSubmitError(
        hubErrorMessage(err, "The access grant could not be added.")
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
          <DialogTitle>Add direct access</DialogTitle>
          <DialogDescription>
            Choose a person or project, then set the access role for{" "}
            <ResourceName>{instrumentName}</ResourceName>.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={principalInputId}>Principal type</FieldLabel>
            <NativeSelect
              disabled={disabled || submitting}
              id={principalInputId}
              onChange={(event) => {
                setPrincipalIndex(Number(event.target.value))
                setQuery("")
                setSelected(undefined)
                setValidationError(undefined)
              }}
              value={String(principalIndex)}
            >
              {principalChoices.map((candidate, index) => (
                <NativeSelectOption key={candidate.kind} value={String(index)}>
                  {candidate.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <ResourceSearchCombobox
            disabled={disabled || submitting}
            excludedIds={existing}
            id={queryInputId}
            kind={choice.searchKind}
            onQueryChange={(nextQuery) => {
              setQuery(nextQuery)
              setValidationError(undefined)
            }}
            onValueChange={(item) => {
              setSelected(item)
              setValidationError(undefined)
            }}
            query={query}
            scope={scope}
            value={selected}
          />
          <Field>
            <FieldLabel htmlFor={roleInputId}>Access role</FieldLabel>
            <NativeSelect
              disabled={disabled || submitting}
              id={roleInputId}
              onChange={(event) => {
                if (isAccessGrantRole(event.target.value)) {
                  setRole(event.target.value)
                }
              }}
              value={role}
            >
              {roles.map((candidate) => (
                <NativeSelectOption key={candidate} value={candidate}>
                  {accessRoleLabel(candidate)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {validationError ? (
            <p className="text-body text-destructive" role="alert">
              {validationError}
            </p>
          ) : null}
          {submitError ? (
            <p className="text-body text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={disabled || submitting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!selected || disabled || submitting}
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
            Add member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
          onValueChange={setCandidate}
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
