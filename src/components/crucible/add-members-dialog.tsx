import { useEffect, useId, useState } from "react"

import type { accessRoles } from "@/components/crucible/access-role-badge"
import {
  accessRoleLabel,
  isAccessGrantRole,
} from "@/components/crucible/access-role-badge"
import { RemoveMemberIcon } from "@/components/crucible/icons"
import { PersonIdentity } from "@/components/crucible/person-identity"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceName } from "@/components/crucible/resource-name"
import { ResourceSearchCombobox } from "@/components/crucible/resource-search-combobox"
import { Button } from "@/components/ui/button"
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
import { useStagedCommit } from "@/components/crucible/use-staged-commit"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type {
  WorkspaceResourceAccessPrincipalKind,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

export type AddMembersRole = Exclude<(typeof accessRoles)[number], "owner">

export type AddMembersPrincipalKind = WorkspaceResourceAccessPrincipalKind

const principalChoices: Record<
  AddMembersPrincipalKind,
  { choice: string; label: string; searchKind: "person" | "project" }
> = {
  projects: { choice: "a project", label: "Project", searchKind: "project" },
  users: { choice: "a person", label: "Person", searchKind: "person" },
}

type StagedMember = {
  member: WorkspaceSearchResult
  role: AddMembersRole
}

export function AddMembersDialog({
  disabled = false,
  excludeServiceAccounts = false,
  existingIds,
  onAdd,
  onOpenChange,
  open,
  principalKinds,
  resourceName,
  roleLabel,
  roles,
  rolesForPrincipal,
  scope,
  title,
}: {
  disabled?: boolean
  excludeServiceAccounts?: boolean
  existingIds: (kind: AddMembersPrincipalKind) => readonly string[]
  onAdd: (
    kind: AddMembersPrincipalKind,
    principalId: string,
    role: AddMembersRole
  ) => Promise<unknown>
  onOpenChange: (open: boolean) => void
  open: boolean
  principalKinds: readonly AddMembersPrincipalKind[]
  resourceName: string
  roleLabel: string
  roles: readonly AddMembersRole[]
  rolesForPrincipal?: (
    member: WorkspaceSearchResult
  ) => readonly AddMembersRole[]
  scope: IdentityScope
  title: string
}) {
  const queryInputId = useId()
  const principalInputId = useId()
  const [principalIndex, setPrincipalIndex] = useState(0)
  const [query, setQuery] = useState("")
  const [staged, setStaged] = useState<StagedMember[]>([])
  const kind = principalKinds[principalIndex] ?? "users"
  const { clearError, commit, commitError, committing, reset } =
    useStagedCommit({
      errorLabel: (count) =>
        count === 1
          ? "1 member could not be added. Try again."
          : `${count} members could not be added. Try again.`,
      items: staged.map((entry) => ({ id: entry.member.unique_id })),
      onAction: async (id) => {
        const entry = staged.find(
          (candidate) => candidate.member.unique_id === id
        )
        if (!entry) return
        await onAdd(kind, id, entry.role)
        setStaged((current) =>
          current.filter((candidate) => candidate.member.unique_id !== id)
        )
      },
      onDone: () => onOpenChange(false),
    })

  const stagedIds = staged.map((entry) => entry.member.unique_id)

  function allowedRolesFor(
    member: WorkspaceSearchResult
  ): readonly AddMembersRole[] {
    return rolesForPrincipal ? rolesForPrincipal(member) : roles
  }

  function stagedRoleFor(
    member: WorkspaceSearchResult,
    lastRole: AddMembersRole | undefined
  ): AddMembersRole {
    const allowed = allowedRolesFor(member)
    if (lastRole && allowed.includes(lastRole)) return lastRole
    return allowed.at(-1) ?? "viewer"
  }

  useEffect(() => {
    if (!open) {
      setPrincipalIndex(0)
      setQuery("")
      setStaged([])
      reset()
    }
  }, [open, reset])

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!committing) onOpenChange(nextOpen)
      }}
      open={open}
    >
      <DialogContent showCloseButton={!committing}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Choose{" "}
            {principalKinds.length > 1
              ? "a person or project"
              : principalChoices[kind].choice}
            , set the {roleLabel.toLowerCase()} for{" "}
            <ResourceName>{resourceName}</ResourceName>, then add as many
            members as you need.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {principalKinds.length > 1 ? (
            <Field>
              <FieldLabel htmlFor={principalInputId}>Principal type</FieldLabel>
              <NativeSelect
                disabled={disabled || committing}
                id={principalInputId}
                onChange={(event) => {
                  setPrincipalIndex(Number(event.target.value))
                  setQuery("")
                  setStaged([])
                  clearError()
                }}
                value={String(principalIndex)}
              >
                {principalKinds.map((candidate, index) => (
                  <NativeSelectOption key={candidate} value={String(index)}>
                    {principalChoices[candidate].label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <ResourceSearchCombobox
            clearAfterSelect
            disabled={disabled || committing}
            excludeServiceAccounts={excludeServiceAccounts}
            excludedIds={[...existingIds(kind), ...stagedIds]}
            id={queryInputId}
            kind={principalChoices[kind].searchKind}
            onQueryChange={setQuery}
            onValueChange={(item) => {
              if (!item) return
              setStaged((current) =>
                current.some(
                  (entry) => entry.member.unique_id === item.unique_id
                )
                  ? current
                  : [
                      ...current,
                      {
                        member: item,
                        role: stagedRoleFor(item, current.at(-1)?.role),
                      },
                    ]
              )
              clearError()
            }}
            query={query}
            scope={scope}
          />
          {staged.length > 0 ? (
            <ul aria-label="Members to add" className="flex flex-col gap-2">
              {staged.map((entry) => {
                const name = entry.member.name
                return (
                  <li
                    className="flex min-w-0 items-center gap-2"
                    key={entry.member.unique_id}
                  >
                    {entry.member.kind === "person" ? (
                      <PersonIdentity
                        className="min-w-0 flex-1"
                        person={entry.member}
                        presentation="avatar"
                        size="sm"
                      />
                    ) : (
                      <ResourceIdentity
                        className="min-w-0 flex-1"
                        context={entry.member.context}
                        kind={entry.member.kind}
                        mfid={entry.member.unique_id}
                        name={entry.member.name}
                        presentation="collection"
                        projectId={entry.member.projectId}
                      />
                    )}
                    <NativeSelect
                      aria-label={`Role for ${name}`}
                      className="w-fit"
                      disabled={disabled || committing}
                      onChange={(event) => {
                        if (isAccessGrantRole(event.target.value)) {
                          const nextRole = event.target.value
                          setStaged((current) =>
                            current.map((candidate) =>
                              candidate.member.unique_id ===
                              entry.member.unique_id
                                ? { ...candidate, role: nextRole }
                                : candidate
                            )
                          )
                        }
                      }}
                      size="sm"
                      value={entry.role}
                    >
                      {allowedRolesFor(entry.member).map((candidate) => (
                        <NativeSelectOption key={candidate} value={candidate}>
                          {accessRoleLabel(candidate)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            aria-label={`Remove ${name}`}
                            disabled={disabled || committing}
                            onClick={() => {
                              setStaged((current) =>
                                current.filter(
                                  (candidate) =>
                                    candidate.member.unique_id !==
                                    entry.member.unique_id
                                )
                              )
                            }}
                            size="icon-sm"
                            type="button"
                            variant="outline"
                          />
                        }
                      >
                        <RemoveMemberIcon aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>Remove</TooltipContent>
                    </Tooltip>
                  </li>
                )
              })}
            </ul>
          ) : null}
          {commitError ? (
            <p className="text-body text-destructive" role="alert">
              {commitError}
            </p>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={committing}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={staged.length === 0 || disabled || committing}
            onClick={() => void commit()}
            type="button"
          >
            {committing ? <PendingIcon data-icon="inline-start" /> : null}
            {staged.length > 1 ? `Add ${staged.length} members` : "Add member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
