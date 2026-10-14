export const userActivityFilters = [
  "active_7",
  "active_30",
  "active_90",
  "inactive_90",
  "never",
] as const

export type UserActivityFilter = (typeof userActivityFilters)[number]

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
