import { OwnerRoleIcon } from "@/components/crucible/icons"
import { Badge } from "@/components/ui/badge"
import { grantName } from "@/data/crucible/resource-access"
import type { WorkspaceResourceAccessGrant } from "@/data/crucible/workspace-source"

export const accessRoles = [
  "owner",
  "admin",
  "editor",
  "contributor",
  "viewer",
] as const

type AccessRole = (typeof accessRoles)[number]
type GrantRole = Exclude<AccessRole, "owner">

const roleVariants = {
  admin: "emphasis",
  contributor: "outline",
  editor: "outline",
  owner: "emphasis",
  viewer: "muted",
} satisfies Record<AccessRole, "emphasis" | "muted" | "outline">

export function accessRoleLabel(role: string) {
  return `${role.at(0)?.toUpperCase() ?? ""}${role.slice(1)}`
}

export function accessRoleRank(role: string) {
  const rank = accessRoles.indexOf(role as AccessRole)
  return rank === -1 ? accessRoles.length : rank
}

export function sortAccessGrants(
  grants: readonly WorkspaceResourceAccessGrant[]
) {
  return [...grants].sort((left, right) => {
    const roleDifference =
      accessRoleRank(left.permission) - accessRoleRank(right.permission)
    if (roleDifference !== 0) return roleDifference
    const nameDifference = grantName(left).localeCompare(grantName(right))
    if (nameDifference !== 0) return nameDifference
    return left.principal_id.localeCompare(right.principal_id)
  })
}

function isAccessRole(role: string): role is AccessRole {
  return role in roleVariants
}

export function isAccessGrantRole(role: string): role is GrantRole {
  return role !== "owner" && isAccessRole(role)
}

export function permittedAccessGrantRoles(
  maxRole: GrantRole | null | undefined
): GrantRole[] {
  if (!maxRole) return []
  const roles = accessRoles.slice(1) as GrantRole[]
  return roles.slice(roles.indexOf(maxRole))
}

export function AccessRoleBadge({
  label,
  role,
}: {
  label?: string
  role: string
}) {
  return (
    <Badge variant={isAccessRole(role) ? roleVariants[role] : "muted"}>
      {role === "owner" ? <OwnerRoleIcon aria-hidden="true" /> : null}
      {label ?? accessRoleLabel(role)}
    </Badge>
  )
}
