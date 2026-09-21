import { useEffect, useMemo, useState } from "react"

import type {
  WorkspaceDataset,
  WorkspaceSample,
} from "@/data/crucible/workspace-source"

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
  if (!value) return Number.NEGATIVE_INFINITY
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp
}
