import { Link, useSearch } from "@tanstack/react-router"

import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"

const sectionLabels = {
  access: "Change visibility",
  instrument: "Change instrument",
  project: "Change project",
} as const

export function ManageSectionLink({
  resource,
  section,
}: {
  resource: WorkspaceResourceDetail
  section: keyof typeof sectionLabels
}) {
  const search = useSearch({ strict: false })
  const fromProject =
    typeof search.fromProject === "string" ? search.fromProject : undefined
  if (resource.capabilities?.can_manage_access !== true) return null
  const props = {
    "aria-label": sectionLabels[section],
    className:
      "text-label text-muted-foreground underline underline-offset-2 hover:text-foreground",
    hash: `manage-${section}`,
    search: { fromProject, preview: undefined },
  }
  if (resource.kind === "sample") {
    return (
      <Link
        {...props}
        params={{ sampleMfid: resource.unique_id }}
        to="/samples/$sampleMfid/manage"
      >
        Change
      </Link>
    )
  }
  if (resource.kind === "dataset") {
    return (
      <Link
        {...props}
        params={{ datasetMfid: resource.unique_id }}
        to="/datasets/$datasetMfid/manage"
      >
        Change
      </Link>
    )
  }
  return null
}
