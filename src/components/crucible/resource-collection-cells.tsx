import type { PersonIdentityProfile } from "@/components/crucible/person-identity"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import type { ResourceType } from "@/components/crucible/resource-type-icon"
import { TableCell } from "@/components/ui/table"
import { formatDate } from "@/lib/format"

export function ResourceUpdatedCell({
  empty = "-",
  value,
}: {
  empty?: string
  value: string | null | undefined
}) {
  return (
    <TableCell className="resource-collection-date" data-label="Updated">
      {value ? formatDate(value) : empty}
    </TableCell>
  )
}

export function ResourceOpenCell({
  fromProject,
  kind,
  mfid,
  name,
}: {
  fromProject?: string
  kind: Exclude<ResourceType, "person">
  mfid: string
  name: string
}) {
  return (
    <TableCell className="resource-collection-action text-center">
      <ResourceFullPageLink
        fromProject={fromProject}
        kind={kind}
        mfid={mfid}
        name={name}
        presentation="table"
      />
    </TableCell>
  )
}

export function ResourceProjectCell({
  project,
  projectId,
  relation,
}: {
  project?: {
    project_id: string
    title?: string | null
    unique_id: string
  } | null
  projectId: string | null | undefined
  relation?: "assigned" | "shared" | null
}) {
  return (
    <TableCell className="resource-collection-project" data-label="Project">
      {project ? (
        <ResourceIdentityLink
          context={
            project.title && project.title !== project.project_id
              ? project.project_id
              : null
          }
          kind="project"
          mfid={project.unique_id}
          name={project.title ?? project.project_id}
          triggerContext={null}
        />
      ) : (
        <span className="block truncate" title={projectId ?? undefined}>
          {relation === "shared"
            ? "Project unavailable"
            : (projectId ?? "Not assigned")}
        </span>
      )}
    </TableCell>
  )
}

export function ResourceOwnerCell({
  owner,
  username,
}: {
  owner?: PersonIdentityProfile | null
  username?: string | null
}) {
  return (
    <TableCell className="resource-collection-owner" data-label="Owner">
      {owner ? (
        <PersonLink nameStyle="abbreviated" person={owner} />
      ) : (
        <span className="block truncate" title={username ?? undefined}>
          {username ?? "Unknown owner"}
        </span>
      )}
    </TableCell>
  )
}
