import type {
  WorkspaceDataset,
  WorkspaceSample,
} from "@/data/crucible/workspace-source"

export type HomeRecentResource =
  | { kind: "dataset"; resource: WorkspaceDataset }
  | { kind: "sample"; resource: WorkspaceSample }

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
