import type {
  WorkspaceResourceAccessGrant,
  WorkspaceResourceDetail,
} from "./workspace-source"

type ProjectAssignedResource = Extract<
  WorkspaceResourceDetail,
  { kind: "dataset" | "sample" }
>

export function isPrimaryProjectAccessGrant(
  resource: ProjectAssignedResource,
  grant: WorkspaceResourceAccessGrant
) {
  if (grant.principal_type !== "project") return false
  if (resource.project?.unique_id) {
    return grant.principal_id === resource.project.unique_id
  }
  return Boolean(resource.project_id && grant.slug === resource.project_id)
}
