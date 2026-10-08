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

export function principalKindFor(
  grant: WorkspaceResourceAccessGrant
): "users" | "projects" | undefined {
  if (grant.principal_type === "user") return "users"
  if (grant.principal_type === "project") return "projects"
  return undefined
}

export function grantName(grant: WorkspaceResourceAccessGrant) {
  return grant.display_name ?? grant.slug ?? grant.principal_id
}

export function grantKey(grant: WorkspaceResourceAccessGrant) {
  return `${grant.principal_type}:${grant.principal_id}`
}
