import { useEffect, useId, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  ProjectRoleBadge,
  sortProjectMembers,
} from "@/components/crucible/project-members"
import { PersonLink } from "@/components/crucible/person-link"
import {
  AddMemberIcon,
  EditMembersIcon,
  RemoveMemberIcon,
  SavingChangesIcon,
} from "@/components/crucible/icons"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  addWorkspaceProjectMember,
  removeWorkspaceProjectMember,
  updateWorkspaceProjectMemberRole,
} from "@/data/crucible/projects.functions"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import { searchQueryOptions } from "@/data/crucible/search.queries"
import type { components } from "@/generated/crucible-api"
import { initials } from "@/lib/format"
import type {
  WorkspaceProject,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

type ProjectMember = components["schemas"]["AccessGroupMemberRead"]
type GrantRole = "viewer" | "contributor" | "editor" | "admin"

const grantRoles = ["viewer", "contributor", "editor", "admin"] as const

export type MembershipProject = WorkspaceProject & {
  capabilities: components["schemas"]["ResourceCapabilities"] | null
  members: readonly ProjectMember[] | null
}

export function ProjectMembershipCard({
  accountId,
  mode,
  project,
  scope,
}: {
  accountId: string
  mode: "api" | "fixture"
  project: MembershipProject
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const searchInputId = useId()
  const roleInputId = useId()
  const [members, setMembers] = useState(project.members)
  const [editingRoles, setEditingRoles] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [personQuery, setPersonQuery] = useState("")
  const [selectedPerson, setSelectedPerson] = useState<WorkspaceSearchResult>()
  const [selectedRole, setSelectedRole] = useState<GrantRole>("viewer")
  const [pendingMember, setPendingMember] = useState<string>()
  const [memberErrors, setMemberErrors] = useState<Record<string, string>>({})
  const [removingMember, setRemovingMember] = useState<ProjectMember>()
  const capabilities = project.capabilities
  const roles = permittedRoles(capabilities?.max_grant_role)
  const canManage = Boolean(
    members !== null && capabilities?.can_manage_access && roles.length
  )
  const canManageMembers = Boolean(
    members !== null && (canManage || capabilities?.can_transfer)
  )
  const normalizedQuery = personQuery.trim()
  const search = useQuery({
    ...searchQueryOptions(scope, normalizedQuery, ["person"]),
    enabled: addOpen && normalizedQuery.length >= 3,
  })
  const personResults =
    search.data?.groups.find((group) => group.kind === "person")?.items ?? []
  const memberList = members ?? []
  const mutationPending = pendingMember !== undefined

  useEffect(() => {
    setMembers(project.members)
  }, [project.members])

  useEffect(() => {
    if (!roles.includes(selectedRole)) setSelectedRole(roles[0] ?? "viewer")
  }, [roles, selectedRole])

  function closeAddDialog(nextOpen: boolean) {
    if (!nextOpen && mutationPending) return
    setAddOpen(nextOpen)
    if (!nextOpen) {
      setPersonQuery("")
      setSelectedPerson(undefined)
      setSelectedRole(roles[0] ?? "viewer")
    }
  }

  function replaceMembers(nextMembers: readonly ProjectMember[]) {
    setMembers(nextMembers)
    const detailQuery = projectQueryOptions(scope, project.unique_id)
    queryClient.setQueryData<WorkspaceProject>(
      detailQuery.queryKey,
      (current) =>
        current
          ? { ...current, members: nextMembers }
          : { ...project, members: nextMembers }
    )
    if (mode === "api") {
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: detailQuery.queryKey,
      })
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.projectLists(scope),
      })
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.searches(scope),
      })
    }
  }

  async function addMember(userId: string) {
    setPendingMember(userId)
    setMemberErrors((current) => withoutMemberError(current, userId))
    try {
      replaceMembers(
        unwrapHubResult(
          await addWorkspaceProjectMember({
            data: {
              projectMfid: project.unique_id,
              role: selectedRole,
              scenario: fixtureScenarioFromScope(scope),
              userId,
            },
          })
        )
      )
      closeAddDialog(false)
    } catch (error) {
      setMemberErrors((current) => ({
        ...current,
        [userId]: membershipErrorMessage(error, "add this member"),
      }))
    } finally {
      setPendingMember(undefined)
    }
  }

  async function changeRole(member: ProjectMember, role: GrantRole) {
    if (role === member.role) return
    setPendingMember(member.unique_id)
    setMemberErrors((current) => withoutMemberError(current, member.unique_id))
    try {
      replaceMembers(
        unwrapHubResult(
          await updateWorkspaceProjectMemberRole({
            data: {
              projectMfid: project.unique_id,
              role,
              scenario: fixtureScenarioFromScope(scope),
              userId: member.unique_id,
            },
          })
        )
      )
    } catch (error) {
      setMemberErrors((current) => ({
        ...current,
        [member.unique_id]: membershipErrorMessage(error, "change this role"),
      }))
    } finally {
      setPendingMember(undefined)
    }
  }

  async function removeMember(member: ProjectMember) {
    setPendingMember(member.unique_id)
    setMemberErrors((current) => withoutMemberError(current, member.unique_id))
    try {
      replaceMembers(
        unwrapHubResult(
          await removeWorkspaceProjectMember({
            data: {
              projectMfid: project.unique_id,
              scenario: fixtureScenarioFromScope(scope),
              userId: member.unique_id,
            },
          })
        )
      )
      return true
    } catch (error) {
      setMemberErrors((current) => ({
        ...current,
        [member.unique_id]: membershipErrorMessage(error, "remove this member"),
      }))
      return false
    } finally {
      setPendingMember(undefined)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access management</CardTitle>
        {canManageMembers ? (
          <CardAction>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={
                      editingRoles
                        ? "Finish managing members"
                        : "Manage members"
                    }
                    aria-pressed={editingRoles}
                    disabled={mutationPending}
                    onClick={() => setEditingRoles((current) => !current)}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  />
                }
              >
                <EditMembersIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>
                {editingRoles ? "Finish managing members" : "Manage members"}
              </TooltipContent>
            </Tooltip>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <h3 className="mb-3 font-heading text-label">Direct members</h3>
        {editingRoles && canManage ? (
          <p
            className="mb-3 text-supporting text-muted-foreground"
            role="status"
          >
            Role changes save automatically.
          </p>
        ) : null}
        {members === null ? (
          <div className="flex items-center gap-2 text-body text-muted-foreground">
            <ResourceTypeIcon type="person" />
            Detailed membership is not available.
          </div>
        ) : members.length === 0 ? (
          <p className="text-body text-muted-foreground">
            No members are currently listed.
          </p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Project members">
            {sortProjectMembers(memberList).map((member) => {
              const canChangeRole =
                canManage &&
                editingRoles &&
                member.role !== "owner" &&
                isGrantRole(member.role) &&
                roles.includes(member.role)
              const canRemove =
                editingRoles &&
                Boolean(capabilities?.can_transfer) &&
                member.role !== "owner" &&
                member.unique_id !== accountId
              const pending = pendingMember === member.unique_id
              return (
                <li className="flex flex-col gap-1" key={member.unique_id}>
                  <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <MemberIdentity member={member} />
                    <div className="flex min-h-8 w-full items-center justify-end gap-2 sm:w-auto sm:shrink-0">
                      {canChangeRole ? (
                        <NativeSelect
                          aria-label={`Role for ${memberName(member)}`}
                          className="w-full sm:w-fit"
                          disabled={mutationPending}
                          onChange={(event) => {
                            if (isGrantRole(event.target.value)) {
                              void changeRole(member, event.target.value)
                            }
                          }}
                          size="sm"
                          value={member.role}
                        >
                          {roles.map((role) => (
                            <NativeSelectOption key={role} value={role}>
                              {roleLabel(role)}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : (
                        <ProjectRoleBadge role={member.role} />
                      )}
                      <span className="inline-flex size-4 items-center justify-center">
                        {pending ? (
                          <SavingChangesIcon
                            aria-label={`Saving ${memberName(member)}'s membership`}
                            className="motion-safe:animate-spin"
                          />
                        ) : null}
                      </span>
                      {canRemove ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                aria-label={`Remove ${memberName(member)}`}
                                disabled={mutationPending}
                                onClick={() => setRemovingMember(member)}
                                size="icon-sm"
                                type="button"
                                variant="destructive"
                              />
                            }
                          >
                            <RemoveMemberIcon aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>Remove member</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                  {memberErrors[member.unique_id] ? (
                    <p className="text-body text-destructive" role="alert">
                      {memberErrors[member.unique_id]}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        {canManage ? (
          <div className="mt-4 flex justify-end">
            <Button
              data-project-membership-add=""
              disabled={mutationPending}
              className="max-sm:w-full"
              onClick={() => setAddOpen(true)}
              type="button"
            >
              <AddMemberIcon data-icon="inline-start" />
              Add member
            </Button>
          </div>
        ) : null}
      </CardContent>
      <Dialog onOpenChange={closeAddDialog} open={addOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>
              Search for a person, choose their role, then add them to this
              project.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={searchInputId}>Search people</FieldLabel>
              <Input
                autoComplete="off"
                id={searchInputId}
                onChange={(event) => {
                  setPersonQuery(event.target.value)
                  setSelectedPerson(undefined)
                }}
                placeholder="Name or identifier"
                type="search"
                value={personQuery}
              />
              <FieldDescription>
                Enter at least 3 characters to search.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={roleInputId}>Project role</FieldLabel>
              <NativeSelect
                id={roleInputId}
                onChange={(event) => {
                  if (isGrantRole(event.target.value)) {
                    setSelectedRole(event.target.value)
                  }
                }}
                value={selectedRole}
              >
                {roles.map((role) => (
                  <NativeSelectOption key={role} value={role}>
                    {roleLabel(role)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
          {normalizedQuery.length < 3 ? null : search.isPending ||
            search.isPlaceholderData ? (
            <p className="text-body text-muted-foreground" role="status">
              Searching people…
            </p>
          ) : search.isError ? (
            <p className="text-body text-destructive" role="alert">
              People could not be searched.
            </p>
          ) : personResults.length === 0 ? (
            <p className="text-body text-muted-foreground">
              No people matched this search.
            </p>
          ) : (
            <ul
              aria-label="People search results"
              className="flex flex-col gap-1"
            >
              {personResults.map((person) => {
                const existingMember = memberList.some(
                  (member) => member.unique_id === person.unique_id
                )
                return (
                  <li key={person.unique_id}>
                    <Button
                      aria-label={`Select ${person.name}`}
                      aria-pressed={
                        selectedPerson?.unique_id === person.unique_id
                      }
                      className="h-auto w-full justify-start py-2 whitespace-normal"
                      disabled={existingMember || mutationPending}
                      onClick={() => setSelectedPerson(person)}
                      type="button"
                      variant={
                        selectedPerson?.unique_id === person.unique_id
                          ? "secondary"
                          : "ghost"
                      }
                    >
                      {pendingMember === person.unique_id ? (
                        <SavingChangesIcon
                          aria-hidden="true"
                          className="motion-safe:animate-spin"
                          data-icon="inline-start"
                        />
                      ) : (
                        <ResourceTypeIcon
                          data-icon="inline-start"
                          type="person"
                        />
                      )}
                      <span className="min-w-0 text-left">
                        <span className="block text-label">{person.name}</span>
                        {person.context ? (
                          <span className="block text-supporting text-muted-foreground">
                            {person.context}
                          </span>
                        ) : null}
                        {existingMember ? (
                          <span className="block text-supporting text-muted-foreground">
                            Already a member
                          </span>
                        ) : null}
                      </span>
                    </Button>
                    {memberErrors[person.unique_id] ? (
                      <p className="text-body text-destructive" role="alert">
                        {memberErrors[person.unique_id]}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
          {selectedPerson ? (
            <p className="text-body">
              {selectedPerson.name} will be added as{" "}
              {roleLabel(selectedRole).toLowerCase()}.
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={mutationPending}
              onClick={() => closeAddDialog(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!selectedPerson || mutationPending}
              onClick={() => {
                if (selectedPerson) void addMember(selectedPerson.unique_id)
              }}
              type="button"
            >
              {mutationPending ? (
                <SavingChangesIcon
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <AddMemberIcon aria-hidden="true" data-icon="inline-start" />
              )}
              Add member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open && pendingMember === removingMember?.unique_id) return
          if (!open) setRemovingMember(undefined)
        }}
        open={Boolean(removingMember)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removingMember
                ? `${memberName(removingMember)} will no longer have access to this project.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removingMember && memberErrors[removingMember.unique_id] ? (
            <p className="text-body text-destructive" role="alert">
              {memberErrors[removingMember.unique_id]}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={Boolean(
                removingMember && pendingMember === removingMember.unique_id
              )}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(
                removingMember && pendingMember === removingMember.unique_id
              )}
              onClick={() => {
                if (!removingMember) return
                const member = removingMember
                void removeMember(member).then((success) => {
                  if (success) setRemovingMember(undefined)
                })
              }}
              variant="destructive"
            >
              {removingMember && pendingMember === removingMember.unique_id ? (
                <SavingChangesIcon
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function MemberIdentity({ member }: { member: ProjectMember }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar>
        <AvatarFallback>
          {initials(member.first_name, member.last_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-label">
          <PersonLink
            name={memberName(member)}
            personId={member.unique_id}
            username={member.username}
          />
        </p>
        <p className="truncate text-body text-muted-foreground">
          {member.username ?? member.unique_id}
          {member.is_service_account ? " (Service account)" : ""}
        </p>
      </div>
    </div>
  )
}

function permittedRoles(maxRole: GrantRole | null | undefined): GrantRole[] {
  if (!maxRole) return []
  return grantRoles.slice(0, grantRoles.indexOf(maxRole) + 1)
}

function isGrantRole(role: string): role is GrantRole {
  return grantRoles.some((candidate) => candidate === role)
}

function roleLabel(role: GrantRole) {
  return `${role.at(0)?.toUpperCase() ?? ""}${role.slice(1)}`
}

function memberName(member: ProjectMember) {
  return `${member.first_name} ${member.last_name}`
}

function withoutMemberError(errors: Record<string, string>, memberId: string) {
  const { [memberId]: _, ...remaining } = errors
  return remaining
}

function membershipErrorMessage(error: unknown, action: string) {
  if (error instanceof HubApiClientError) return error.message
  return `Could not ${action}. Try again.`
}
