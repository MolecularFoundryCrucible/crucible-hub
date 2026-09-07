import { useEffect, useId, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  ProjectRoleBadge,
  sortProjectMembers,
} from "@/components/crucible/project-members"
import {
  AddMemberIcon,
  EditMembersIcon,
  LeaveProjectIcon,
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
import type { WorkspaceProject } from "@/data/crucible/workspace-source"
import { projectMembershipActions } from "./project-membership-access"

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
  onLeaveSuccess,
  project,
  scope,
}: {
  accountId: string
  mode: "api" | "fixture"
  onLeaveSuccess?: () => void
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
  const [selectedRole, setSelectedRole] = useState<GrantRole>("viewer")
  const [pendingMember, setPendingMember] = useState<string>()
  const [memberErrors, setMemberErrors] = useState<Record<string, string>>({})
  const [removingMember, setRemovingMember] = useState<ProjectMember>()
  const [leaving, setLeaving] = useState(false)
  const capabilities = project.capabilities
  const roles = permittedRoles(capabilities?.max_grant_role)
  const canManage = Boolean(
    members !== null && capabilities?.can_manage_access && roles.length
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

  async function removeMember(member: ProjectMember, isLeaving: boolean) {
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
      if (isLeaving) onLeaveSuccess?.()
      return true
    } catch (error) {
      setMemberErrors((current) => ({
        ...current,
        [member.unique_id]: membershipErrorMessage(
          error,
          isLeaving ? "leave this project" : "remove this member"
        ),
      }))
      return false
    } finally {
      setPendingMember(undefined)
    }
  }

  const { canLeave, currentMember } = projectMembershipActions(
    { capabilities, members },
    accountId
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardAction>
          <div className="flex flex-wrap justify-end gap-2">
            {canLeave ? (
              <Button
                disabled={mutationPending}
                onClick={() => setLeaving(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                <LeaveProjectIcon data-icon="inline-start" />
                Leave project
              </Button>
            ) : null}
            {canManage ? (
              <Button
                disabled={mutationPending}
                onClick={() => setEditingRoles((current) => !current)}
                size="sm"
                type="button"
                variant="outline"
              >
                <EditMembersIcon data-icon="inline-start" />
                {editingRoles ? "Done editing" : "Edit roles"}
              </Button>
            ) : null}
            {canManage ? (
              <Button
                disabled={mutationPending}
                onClick={() => setAddOpen(true)}
                size="sm"
                type="button"
              >
                <AddMemberIcon data-icon="inline-start" />
                Add member
              </Button>
            ) : null}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
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
                Boolean(capabilities?.can_transfer) &&
                member.role !== "owner" &&
                member.unique_id !== accountId
              const pending = pendingMember === member.unique_id
              return (
                <li className="flex flex-col gap-1" key={member.unique_id}>
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberIdentity member={member} />
                    <div className="flex min-h-8 shrink-0 items-center justify-end gap-2">
                      {canChangeRole ? (
                        <NativeSelect
                          aria-label={`Role for ${memberName(member)}`}
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
                                variant="ghost"
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
                onChange={(event) => setPersonQuery(event.target.value)}
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
                      aria-label={`Add ${person.name}`}
                      className="h-auto w-full justify-start py-2 whitespace-normal"
                      disabled={existingMember || mutationPending}
                      onClick={() => void addMember(person.unique_id)}
                      type="button"
                      variant="ghost"
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
                void removeMember(member, false).then((success) => {
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
      <AlertDialog
        onOpenChange={(open) => {
          if (!open && pendingMember === currentMember?.unique_id) return
          setLeaving(open)
        }}
        open={leaving}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave project?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to this project and its shared resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {currentMember && memberErrors[currentMember.unique_id] ? (
            <p className="text-body text-destructive" role="alert">
              {memberErrors[currentMember.unique_id]}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={Boolean(
                currentMember && pendingMember === currentMember.unique_id
              )}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(
                currentMember && pendingMember === currentMember.unique_id
              )}
              onClick={() => {
                if (!currentMember) return
                void removeMember(currentMember, true).then((success) => {
                  if (success) setLeaving(false)
                })
              }}
              variant="destructive"
            >
              {currentMember && pendingMember === currentMember.unique_id ? (
                <SavingChangesIcon
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              Leave project
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
        <p className="truncate text-label">{memberName(member)}</p>
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
