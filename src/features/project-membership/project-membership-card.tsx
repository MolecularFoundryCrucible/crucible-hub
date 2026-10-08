import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import {
  ProjectRoleBadge,
  sortProjectMembers,
} from "@/components/crucible/project-members"
import { accessRoleLabel } from "@/components/crucible/access-role-badge"
import { AccessGrantRow } from "@/components/crucible/access-grant-row"
import { useAccessListManagement } from "@/components/crucible/access-list-management"
import { AccessManagementToggle } from "@/components/crucible/access-management-toggle"
import { AddMembersDialog } from "@/components/crucible/add-members-dialog"
import type { AddMembersPrincipalKind } from "@/components/crucible/add-members-dialog"
import { RemoveMembersDialog } from "@/components/crucible/remove-members-dialog"
import type { RemovableMember } from "@/components/crucible/remove-members-dialog"
import { PersonLink } from "@/components/crucible/person-link"
import { personDisplayName } from "@/components/crucible/person-identity"
import {
  AddMemberIcon,
  RemoveMemberIcon,
  SavingChangesIcon,
} from "@/components/crucible/icons"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  addWorkspaceProjectMember,
  removeWorkspaceProjectMember,
  updateWorkspaceProjectMemberRole,
} from "@/data/crucible/projects.functions"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import type { components } from "@/generated/crucible-api"
import { resourceDisplayName } from "@/lib/resource-name"
import type { WorkspaceProject } from "@/data/crucible/workspace-source"

type ProjectMember = components["schemas"]["AccessGroupMemberRead"]
type GrantRole = "viewer" | "contributor" | "editor" | "admin"

const grantRoles = ["viewer", "contributor", "editor", "admin"] as const

export type MembershipProject = WorkspaceProject & {
  capabilities: components["schemas"]["ResourceCapabilities"] | null
  members: ProjectMember[] | null
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
  const [members, setMembers] = useState(project.members)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [memberErrors, setMemberErrors] = useState<Record<string, string>>({})
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const {
    managing,
    setManaging,
    savingAnything,
    selection: selectedForRemoval,
    isSaving,
    stageOne,
    startSaving,
    stopSaving,
    toggleSelection,
  } = useAccessListManagement()
  const capabilities = project.capabilities
  const roles = useMemo(
    () => permittedRoles(capabilities?.max_grant_role),
    [capabilities?.max_grant_role]
  )
  const canManage = Boolean(
    members !== null && capabilities?.can_manage_access && roles.length
  )
  const canManageMembers = Boolean(
    members !== null && (canManage || capabilities?.can_transfer)
  )
  const memberList = members ?? []
  const mutationPending = savingAnything
  const selectedMembers = sortProjectMembers(memberList).filter((member) =>
    selectedForRemoval.has(member.unique_id)
  )
  const removableSelection: readonly RemovableMember[] = selectedMembers.map(
    (member) => ({ id: member.unique_id, label: memberName(member) })
  )

  useEffect(() => {
    setMembers(project.members)
  }, [project.members])

  function replaceMembers(nextMembers: ProjectMember[]) {
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

  async function addStagedMember(
    _kind: AddMembersPrincipalKind,
    userId: string,
    role: GrantRole
  ) {
    replaceMembers(
      unwrapHubResult(
        await addWorkspaceProjectMember({
          data: {
            projectMfid: project.unique_id,
            role,
            scenario: fixtureScenarioFromScope(scope),
            userId,
          },
        })
      )
    )
  }

  async function changeRole(member: ProjectMember, role: GrantRole) {
    if (role === member.role) return
    startSaving(member.unique_id)
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
      stopSaving()
    }
  }

  async function commitMemberRemoval(userId: string) {
    replaceMembers(
      unwrapHubResult(
        await removeWorkspaceProjectMember({
          data: {
            projectMfid: project.unique_id,
            scenario: fixtureScenarioFromScope(scope),
            userId,
          },
        })
      )
    )
    toggleSelection(userId, false)
    setMemberErrors((current) => withoutMemberError(current, userId))
  }

  return (
    <Card>
      <CardHeader actionLayout="inline">
        <CardTitle>Access management</CardTitle>
        {canManageMembers ? (
          <CardAction>
            <AccessManagementToggle
              active={managing}
              disabled={mutationPending}
              onChange={setManaging}
              subject="members"
            />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <h3 className="font-heading text-label">Direct members</h3>
        {managing && canManage ? (
          <p className="mb-3 text-body text-muted-foreground" role="status">
            Role changes save automatically.
          </p>
        ) : (
          <p className="mb-3 text-body text-muted-foreground">
            Direct members of this project.
          </p>
        )}
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
              const memberRoles = permittedTargetRoles(
                roles,
                member.is_service_account === true
              )
              const canChangeRole =
                canManage &&
                managing &&
                member.role !== "owner" &&
                isGrantRole(member.role) &&
                memberRoles.includes(member.role)
              const canRemove =
                managing &&
                Boolean(capabilities?.can_transfer) &&
                member.role !== "owner" &&
                member.unique_id !== accountId
              const removeBlockedReason =
                member.role === "owner"
                  ? "The manager cannot be removed here"
                  : member.unique_id === accountId
                    ? "You cannot remove your own membership here"
                    : "This member cannot be removed here"
              return (
                <AccessGrantRow
                  error={memberErrors[member.unique_id]}
                  identity={<MemberIdentity member={member} />}
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
                  PendingIcon={SavingChangesIcon}
                  revocable={canRemove}
                  revokeAriaLabel={`Remove ${memberName(member)}`}
                  revokeTooltipLabel="Remove member"
                  roleBadge={<ProjectRoleBadge role={member.role} />}
                  roleEditor={
                    canChangeRole ? (
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
                        {memberRoles.map((role) => (
                          <NativeSelectOption key={role} value={role}>
                            {accessRoleLabel(role)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    ) : undefined
                  }
                  selectable={canRemove}
                  selected={selectedForRemoval.has(member.unique_id)}
                  selectionLabel={`Select ${memberName(member)} for removal`}
                  onSelectionChange={(checked) =>
                    toggleSelection(member.unique_id, checked)
                  }
                />
              )
            })}
          </ul>
        )}
        {canManage || removableSelection.length > 0 ? (
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
                  ? `Remove ${removableSelection.length} members`
                  : "Remove member"}
              </Button>
            ) : null}
            {canManage ? (
              <Button
                disabled={mutationPending}
                className="max-sm:w-full"
                onClick={() => setAddMemberOpen(true)}
                type="button"
              >
                <AddMemberIcon data-icon="inline-start" />
                Add member
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      <AddMembersDialog
        disabled={mutationPending}
        existingIds={() => memberList.map((member) => member.unique_id)}
        onAdd={addStagedMember}
        onOpenChange={setAddMemberOpen}
        open={addMemberOpen}
        principalKinds={["users"]}
        resourceName={resourceDisplayName("project", project.title, {
          identifier: project.project_id,
          mfid: project.unique_id,
        })}
        roleLabel="Project role"
        roles={roles}
        rolesForPrincipal={(member) =>
          permittedTargetRoles(roles, member.is_service_account === true)
        }
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
              access to this project.
            </>
          ) : removableSelection[0] ? (
            <>
              {removableSelection[0].label} will no longer have access to this
              project.
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
        onRemove={commitMemberRemoval}
        open={removeDialogOpen}
        title={
          removableSelection.length > 1 ? "Remove members?" : "Remove member?"
        }
      />
    </Card>
  )
}

function MemberIdentity({ member }: { member: ProjectMember }) {
  return <PersonLink className="flex-1" person={member} presentation="avatar" />
}

function permittedRoles(maxRole: GrantRole | null | undefined): GrantRole[] {
  if (!maxRole) return []
  return grantRoles.slice(0, grantRoles.indexOf(maxRole) + 1)
}

function permittedTargetRoles(
  roles: readonly GrantRole[],
  serviceAccount: boolean
) {
  return serviceAccount
    ? roles.filter((role) => role === "viewer" || role === "contributor")
    : [...roles]
}

function isGrantRole(role: string): role is GrantRole {
  return grantRoles.some((candidate) => candidate === role)
}

function memberName(member: ProjectMember) {
  return personDisplayName(member)
}

function withoutMemberError(errors: Record<string, string>, memberId: string) {
  const { [memberId]: _, ...remaining } = errors
  return remaining
}

function membershipErrorMessage(error: unknown, action: string) {
  return hubErrorMessage(error, `Could not ${action}. Try again.`)
}
