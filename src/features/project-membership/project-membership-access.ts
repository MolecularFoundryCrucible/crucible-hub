import type { components } from "@/generated/crucible-api"

type ProjectMembershipAccess = {
  capabilities?: components["schemas"]["ResourceCapabilities"] | null
  members?: readonly components["schemas"]["AccessGroupMemberRead"][] | null
}

export function projectMembershipActions(
  project: ProjectMembershipAccess,
  accountId: string
) {
  const currentMember = project.members?.find(
    (member) => member.unique_id === accountId
  )
  const canLeave = currentMember !== undefined && currentMember.role !== "owner"
  const canManageAccess = project.capabilities?.can_manage_access === true
  const canTransfer = project.capabilities?.can_transfer === true

  return {
    canLeave,
    canManageAccess,
    canTransfer,
    canUseMembership: canLeave || canManageAccess || canTransfer,
    currentMember,
  }
}
