import { Badge } from "@/components/ui/badge"

export const accessRoles = [
  "owner",
  "admin",
  "editor",
  "contributor",
  "viewer",
] as const

type AccessRole = (typeof accessRoles)[number]
type GrantRole = Exclude<AccessRole, "owner">

const roleClasses = {
  admin:
    "border-access-role-admin bg-access-role-admin text-access-role-admin-foreground",
  contributor:
    "border-access-role-contributor bg-access-role-contributor text-access-role-contributor-foreground",
  editor:
    "border-access-role-editor bg-access-role-editor text-access-role-editor-foreground",
  owner: "border-foreground bg-secondary text-secondary-foreground",
  viewer:
    "border-access-role-viewer bg-access-role-viewer text-access-role-viewer-foreground",
} satisfies Record<AccessRole, string>

export function accessRoleLabel(role: string) {
  return `${role.at(0)?.toUpperCase() ?? ""}${role.slice(1)}`
}

export function accessRoleRank(role: string) {
  const rank = accessRoles.indexOf(role as AccessRole)
  return rank === -1 ? accessRoles.length : rank
}

export function isAccessRole(role: string): role is AccessRole {
  return role in roleClasses
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
  const roleClass = isAccessRole(role) ? roleClasses[role] : undefined
  return (
    <Badge
      className={roleClass ?? "border-border bg-muted text-muted-foreground"}
    >
      {label ?? accessRoleLabel(role)}
    </Badge>
  )
}
