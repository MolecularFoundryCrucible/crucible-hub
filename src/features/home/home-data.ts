import { resolveCollectionAffiliation } from "@/data/crucible/public-data"
import { useEffect, useMemo, useState } from "react"

import type {
  WorkspaceDataset,
  WorkspaceSample,
} from "@/data/crucible/workspace-source"
import { parseTimestamp } from "@/lib/format"

export type HomeRecentResource =
  | { kind: "dataset"; resource: WorkspaceDataset }
  | { kind: "sample"; resource: WorkspaceSample }

type RecentResourcesSnapshot = {
  identity: string
  resources: readonly HomeRecentResource[]
}

export function useRecentResourcesSnapshot({
  datasets,
  datasetsFetching,
  identity,
  limit,
  samples,
  samplesFetching,
}: {
  datasets: readonly WorkspaceDataset[] | undefined
  datasetsFetching: boolean
  identity: string
  limit: number
  samples: readonly WorkspaceSample[] | undefined
  samplesFetching: boolean
}) {
  const candidate = useMemo(
    () => selectRecentResources(samples ?? [], datasets ?? [], limit),
    [datasets, limit, samples]
  )
  const [snapshot, setSnapshot] = useState<RecentResourcesSnapshot | null>(
    () =>
      samples !== undefined && datasets !== undefined
        ? { identity, resources: candidate }
        : null
  )
  const settled = !samplesFetching && !datasetsFetching

  useEffect(() => {
    if (!settled) return
    setSnapshot({ identity, resources: candidate })
  }, [candidate, identity, settled])

  const committed = snapshot?.identity === identity ? snapshot.resources : null
  return {
    pending: !settled && committed === null,
    resources: settled ? candidate : (committed ?? []),
  }
}

export function selectRecentResources(
  samples: readonly WorkspaceSample[],
  datasets: readonly WorkspaceDataset[],
  limit: number
): HomeRecentResource[] {
  return [
    ...samples.map((resource) => ({ kind: "sample" as const, resource })),
    ...datasets.map((resource) => ({ kind: "dataset" as const, resource })),
  ]
    .sort((left, right) => {
      const timeDifference =
        creationTime(right.resource.creation_time) -
        creationTime(left.resource.creation_time)
      return (
        timeDifference ||
        right.resource.unique_id.localeCompare(left.resource.unique_id)
      )
    })
    .slice(0, limit)
}

function creationTime(value: string | null | undefined) {
  return parseTimestamp(value)?.getTime() ?? Number.NEGATIVE_INFINITY
}

export const homeProjectLimit = 7
const homeInstrumentLimit = 7
export const homeRecentResourceLimit = 5

export const homeInstrumentQuery = {
  affiliation: "managed",
  includeOwner: false,
  includeTotal: false,
  limit: homeInstrumentLimit,
  status: "active",
} as const

const homeRecentResourceQuery = {
  direction: "desc",
  includeTotal: false,
  limit: homeRecentResourceLimit,
  sort: "created",
} as const

export const recentScopeOptions = [
  { label: "All", value: "all" },
  { label: "Mine", value: "mine" },
] as const

export function homeRecentResourceFilters({
  elevated,
  includePublicByDefault,
  recentScope,
}: {
  elevated: boolean
  includePublicByDefault: boolean
  recentScope: "all" | "mine"
}) {
  const affiliation = resolveCollectionAffiliation({
    elevated,
    includePublicByDefault,
    ownership: recentScope === "mine" ? "owner" : undefined,
  })
  return {
    ...homeRecentResourceQuery,
    ...(affiliation ? { affiliation } : {}),
  }
}
