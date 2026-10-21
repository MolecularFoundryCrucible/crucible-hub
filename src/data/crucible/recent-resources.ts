export type RecentResourceKind = "dataset" | "instrument" | "project" | "sample"

export type RecentResource = {
  identifier: string | null
  kind: RecentResourceKind
  name: string
  projectId: string | null
  uniqueId: string
  viewedAt: string
}

export const recentResourceLimit = 10
