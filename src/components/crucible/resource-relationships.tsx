import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"

import { OpenFullPageIcon } from "@/components/crucible/icons"
import { ResourceName } from "@/components/crucible/resource-name"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourcePreviewLink } from "@/components/crucible/resource-preview-navigation"
import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { workspaceRelationshipTypeLabel } from "@/data/crucible/resource-relationships"
import type { WorkspaceLinkedResource } from "@/data/crucible/workspace-source"
import { cn } from "@/lib/utils"

type RelationshipResourceKind = "dataset" | "sample"

export function groupResourceRelationships(
  kind: RelationshipResourceKind,
  links: readonly WorkspaceLinkedResource[]
) {
  const groups = [
    {
      title: "Parents",
      links: links.filter((link) => link.relationship === "parent"),
    },
    {
      title: "Children",
      links: links.filter((link) => link.relationship === "child"),
    },
    {
      title: kind === "sample" ? "Linked datasets" : "Linked samples",
      links: links.filter((link) => link.relationship === "associated"),
    },
  ]
  return groups.filter((group) => group.links.length > 0)
}

export function ResourceRelationships({
  groupHeadingLevel = 3,
  kind,
  links,
  managing = false,
  renderManagementAction,
}: {
  groupHeadingLevel?: 3 | 4
  kind: RelationshipResourceKind
  links: readonly WorkspaceLinkedResource[] | null
  managing?: boolean
  renderManagementAction?: (link: WorkspaceLinkedResource) => ReactNode
}) {
  if (links === null) {
    return (
      <p className="text-body text-muted-foreground">
        Relationship data is unavailable for this resource.
      </p>
    )
  }
  if (links.length === 0) {
    return (
      <p className="text-body text-muted-foreground">
        No immediate relationships are recorded.
      </p>
    )
  }

  const GroupHeading = groupHeadingLevel === 4 ? "h4" : "h3"

  return (
    <div className="flex flex-col gap-5">
      {groupResourceRelationships(kind, links).map((group) => (
        <section className="min-w-0" key={group.title}>
          <GroupHeading className="text-label">
            {group.title} ({group.links.length})
          </GroupHeading>
          <ul className="mt-2 flex min-w-0 flex-col">
            {group.links.map((link) => (
              <RelationshipRow
                key={`${link.relationship}:${link.resource_type}:${link.unique_id}`}
                link={link}
                managing={managing}
                renderManagementAction={renderManagementAction}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function RelationshipRow({
  link,
  managing,
  renderManagementAction,
}: {
  link: WorkspaceLinkedResource
  managing: boolean
  renderManagementAction?: (link: WorkspaceLinkedResource) => ReactNode
}) {
  const label = link.name || link.unique_id
  const relationshipTypeLabel = workspaceRelationshipTypeLabel(link)
  const identity = isKnownResourceType(link.resource_type) ? (
    <ResourceIdentity
      context={relationshipTypeLabel}
      interactive
      kind={link.resource_type}
      name={label}
    />
  ) : (
    <span className="min-w-0 flex-1">
      <span className="block text-label wrap-break-word">{label}</span>
      {relationshipTypeLabel ? (
        <span className="block text-supporting text-muted-foreground">
          {relationshipTypeLabel}
        </span>
      ) : null}
    </span>
  )
  return (
    <li className="flex min-w-0 items-center gap-2 border-b border-border py-3 last:border-0">
      {link.resource_type === "sample" || link.resource_type === "dataset" ? (
        <ResourcePreviewLink
          className="group/resource min-w-0 flex-1"
          mfid={link.unique_id}
          resourceKind={link.resource_type}
        >
          <span className="sr-only">Preview {label}</span>
          <span aria-hidden="true" className="block">
            {identity}
          </span>
        </ResourcePreviewLink>
      ) : (
        <div className="min-w-0 flex-1">{identity}</div>
      )}
      <div className="flex shrink-0 items-center">
        {managing ? (
          renderManagementAction?.(link)
        ) : (
          <CanonicalResourceLink link={link} />
        )}
      </div>
    </li>
  )
}

function CanonicalResourceLink({ link }: { link: WorkspaceLinkedResource }) {
  const label = link.name || link.unique_id
  const className = cn(buttonVariants({ size: "icon-sm", variant: "outline" }))
  if (link.resource_type === "sample") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              aria-label={`Open full page: ${label}`}
              className={className}
              params={{ sampleMfid: link.unique_id }}
              preload={false}
              search={{ preview: undefined }}
              state={{}}
              to="/samples/$sampleMfid"
            />
          }
        >
          <OpenFullPageIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>
          Open full page: <ResourceName>{label}</ResourceName>
        </TooltipContent>
      </Tooltip>
    )
  }
  if (link.resource_type === "dataset") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              aria-label={`Open full page: ${label}`}
              className={className}
              params={{ datasetMfid: link.unique_id }}
              preload={false}
              search={{ preview: undefined }}
              state={{}}
              to="/datasets/$datasetMfid"
            />
          }
        >
          <OpenFullPageIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>
          Open full page: <ResourceName>{label}</ResourceName>
        </TooltipContent>
      </Tooltip>
    )
  }
  if (link.resource_type === "project") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              aria-label={`Open full page: ${label}`}
              className={className}
              params={{ projectMfid: link.unique_id }}
              preload={false}
              state={{}}
              to="/projects/$projectMfid"
            />
          }
        >
          <OpenFullPageIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>
          Open full page: <ResourceName>{label}</ResourceName>
        </TooltipContent>
      </Tooltip>
    )
  }
  if (link.resource_type === "instrument") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              aria-label={`Open full page: ${label}`}
              className={className}
              params={{ instrumentMfid: link.unique_id }}
              preload={false}
              state={{}}
              to="/instruments/$instrumentMfid"
            />
          }
        >
          <OpenFullPageIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>
          Open full page: <ResourceName>{label}</ResourceName>
        </TooltipContent>
      </Tooltip>
    )
  }
  return null
}

function isKnownResourceType(
  value: string
): value is "dataset" | "instrument" | "project" | "sample" {
  return ["dataset", "instrument", "project", "sample"].includes(value)
}
