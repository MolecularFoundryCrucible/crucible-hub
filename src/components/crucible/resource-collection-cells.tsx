import type { PersonIdentityProfile } from "@/components/crucible/person-identity"
import { PersonLink } from "@/components/crucible/person-link"
import { ActivityTime } from "@/components/crucible/activity-time"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import type { ResourceType } from "@/components/crucible/resource-type-icon"
import { TableCell } from "@/components/ui/table"
import { TruncatedText } from "@/components/ui/truncation-tooltip"
import { cn } from "@/lib/utils"
import { resourceDisplayName } from "@/lib/resource-name"

export function ResourceCreatedCell({
  className,
  empty = "-",
  value,
}: {
  className?: string
  empty?: string
  value: string | null | undefined
}) {
  return (
    <ResourceDateCell
      className={className}
      empty={empty}
      label="Created"
      value={value}
    />
  )
}

export function ResourceUpdatedCell({
  className,
  empty = "-",
  value,
}: {
  className?: string
  empty?: string
  value: string | null | undefined
}) {
  return (
    <ResourceDateCell
      className={className}
      empty={empty}
      label="Updated"
      value={value}
    />
  )
}

export function ResourceActivityCell({
  className,
  value,
}: {
  className?: string
  value: string | null | undefined
}) {
  return (
    <TableCell
      kind="date"
      className={cn(
        "resource-collection-date resource-directory-date",
        className
      )}
      data-label="Last activity"
    >
      <ActivityTime fallback="None yet" value={value} />
    </TableCell>
  )
}

function ResourceDateCell({
  className,
  empty,
  label,
  value,
}: {
  className?: string
  empty: string
  label: "Created" | "Updated"
  value: string | null | undefined
}) {
  return (
    <TableCell
      kind="date"
      className={cn(
        "resource-collection-date resource-directory-date",
        className
      )}
      data-label={label}
    >
      <LocalDateTime fallback={empty} value={value} />
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
  kind: Exclude<ResourceType, "file" | "person">
  mfid: string
  name: string
}) {
  return (
    <TableCell
      kind="action"
      className="resource-collection-action resource-directory-action"
    >
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
          name={resourceDisplayName("project", project.title, {
            identifier: project.project_id,
            mfid: project.unique_id,
          })}
          showTypeIcon={false}
          triggerContext={null}
        />
      ) : (
        <TruncatedText className="block truncate" label={projectId}>
          {relation === "shared"
            ? "Project unavailable"
            : (projectId ?? "Not assigned")}
        </TruncatedText>
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
        <PersonLink
          nameStyle="abbreviated"
          person={owner}
          presentation="collection"
        />
      ) : (
        <TruncatedText className="block truncate" label={username}>
          {username ?? "Unknown owner"}
        </TruncatedText>
      )}
    </TableCell>
  )
}
