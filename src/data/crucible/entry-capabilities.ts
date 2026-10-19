import type { components } from "@/generated/crucible-api"

type AccessPermission = components["schemas"]["AccessPermission"]
type EntryCapabilities = components["schemas"]["EntryCapabilities"]

const grantOrder = ["viewer", "contributor", "editor", "admin"] as const
const serviceAccountRoles: readonly AccessPermission[] = [
  "viewer",
  "contributor",
]

export function fixtureEntryCapabilities({
  fixed = false,
  maxGrantRole,
  role,
  self = false,
  serviceAccount = false,
}: {
  fixed?: boolean
  maxGrantRole: AccessPermission | null | undefined
  role: string
  self?: boolean
  serviceAccount?: boolean
}): EntryCapabilities {
  const maxRank = grantOrder.findIndex(
    (candidate) => candidate === maxGrantRole
  )
  const rank = grantOrder.findIndex((candidate) => candidate === role)
  const withinReach = !fixed && rank !== -1 && rank <= maxRank
  const assignable = withinReach
    ? grantOrder
        .slice(0, maxRank + 1)
        .filter(
          (candidate) =>
            !serviceAccount || serviceAccountRoles.includes(candidate)
        )
    : []
  return {
    assignable_roles: assignable,
    can_change_role: assignable.some((candidate) => candidate !== role),
    can_remove: !fixed && role !== "owner" && (self || withinReach),
  }
}

export function entryActions<TRole extends string>(
  capabilities: EntryCapabilities | null | undefined,
  currentRole: string,
  roleOrder: readonly TRole[]
) {
  const assignable = capabilities?.assignable_roles ?? []
  const roleOptions = roleOrder.filter(
    (role) =>
      assignable.some((candidate) => candidate === role) || role === currentRole
  )
  return {
    canChangeRole:
      capabilities?.can_change_role === true &&
      roleOptions.some((role) => role !== currentRole),
    canRemove: capabilities?.can_remove === true,
    roleOptions,
  }
}
