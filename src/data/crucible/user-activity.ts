export const userActivityFilters = [
  "active_7",
  "active_30",
  "active_90",
  "inactive_90",
  "never",
] as const

export type UserActivityFilter = (typeof userActivityFilters)[number]

export const userActivityFilterOptions = [
  { label: "Any activity", value: "" },
  { label: "Active in the last 7 days", value: "active_7" },
  { label: "Active in the last 30 days", value: "active_30" },
  { label: "Active in the last 90 days", value: "active_90" },
  { label: "Inactive for 90 days or more", value: "inactive_90" },
  { label: "Never active", value: "never" },
] as const

const day = 24 * 60 * 60 * 1000

export function userActivityQuery(
  filter: UserActivityFilter | undefined,
  now = Date.now()
): {
  active_since?: string
  inactive_since?: string
  never_active?: boolean
} {
  if (!filter) return {}
  if (filter === "never") return { never_active: true }
  if (filter === "inactive_90") {
    return { inactive_since: new Date(now - 90 * day).toISOString() }
  }
  const days = Number(filter.slice("active_".length))
  return { active_since: new Date(now - days * day).toISOString() }
}
