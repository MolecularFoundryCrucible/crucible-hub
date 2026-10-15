import { useId, useState } from "react"
import type { ReactNode } from "react"

import { UnlinkRelationshipIcon } from "@/components/crucible/icons"
import {
  COLLAPSED_LIST_LIMIT,
  ListExpansionToggle,
  revealedRowClassName,
} from "@/components/crucible/list-expansion-toggle"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceNameLink } from "@/components/crucible/resource-name-link"
import {
  ResourceList,
  ResourceListItem,
  ResourceListItemContent,
} from "@/components/crucible/resource-list"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  compareWorkspaceRelationshipResources,
  workspaceRelationshipTypeLabel,
} from "@/data/crucible/resource-relationships"
import type { WorkspaceLinkedResource } from "@/data/crucible/workspace-source"
import { resourceDisplayName } from "@/lib/resource-name"

export function UnlinkRelationshipAction({
  disabled = false,
  label,
  onClick,
  tooltip,
}: {
  disabled?: boolean
  label: string
  onClick: () => void
  tooltip: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            size="icon-sm"
            type="button"
            variant="outline"
          />
        }
      >
        <UnlinkRelationshipIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

type RelationshipResourceKind = "dataset" | "sample"

function relationshipDisplayName(link: WorkspaceLinkedResource) {
  return link.resource_type === "sample" || link.resource_type === "dataset"
    ? resourceDisplayName(link.resource_type, link.name)
    : link.name || link.unique_id
}

export function groupResourceRelationships(
  kind: RelationshipResourceKind,
  links: readonly WorkspaceLinkedResource[]
) {
  const groups = [
    {
      title: "Parents",
      links: links
        .filter((link) => link.relationship === "parent")
        .sort(compareWorkspaceRelationshipResources),
    },
    {
      title: "Children",
      links: links
        .filter((link) => link.relationship === "child")
        .sort(compareWorkspaceRelationshipResources),
    },
    {
      title: kind === "sample" ? "Linked datasets" : "Linked samples",
      links: links
        .filter((link) => link.relationship === "associated")
        .sort(compareWorkspaceRelationshipResources),
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

  return (
    <div className="flex flex-col gap-5">
      {groupResourceRelationships(kind, links).map((group) => (
        <RelationshipGroup
          headingLevel={groupHeadingLevel}
          key={group.title}
          links={group.links}
          managing={managing}
          renderManagementAction={renderManagementAction}
          title={group.title}
        />
      ))}
    </div>
  )
}

function RelationshipGroup({
  headingLevel,
  links,
  managing,
  renderManagementAction,
  title,
}: {
  headingLevel: 3 | 4
  links: readonly WorkspaceLinkedResource[]
  managing: boolean
  renderManagementAction?: (link: WorkspaceLinkedResource) => ReactNode
  title: string
}) {
  const listId = useId()
  const [expanded, setExpanded] = useState(false)
  const GroupHeading = headingLevel === 4 ? "h4" : "h3"
  const visibleLinks = expanded ? links : links.slice(0, COLLAPSED_LIST_LIMIT)
  return (
    <section className="min-w-0">
      <GroupHeading className="text-label">
        {title} ({links.length})
      </GroupHeading>
      <ResourceList className="mt-2" id={listId}>
        {visibleLinks.map((link, index) => (
          <RelationshipRow
            className={revealedRowClassName(index)}
            key={`${link.relationship}:${link.resource_type}:${link.unique_id}`}
            link={link}
            managing={managing}
            renderManagementAction={renderManagementAction}
          />
        ))}
      </ResourceList>
      {links.length > COLLAPSED_LIST_LIMIT ? (
        <div className="mt-1 -ml-1.5 flex">
          <ListExpansionToggle
            controls={listId}
            expanded={expanded}
            noun={title.toLowerCase()}
            onExpandedChange={setExpanded}
            total={links.length}
          />
        </div>
      ) : null}
    </section>
  )
}

function RelationshipRow({
  className,
  link,
  managing,
  renderManagementAction,
}: {
  className?: string
  link: WorkspaceLinkedResource
  managing: boolean
  renderManagementAction?: (link: WorkspaceLinkedResource) => ReactNode
}) {
  const label = relationshipDisplayName(link)
  const relationshipTypeLabel = workspaceRelationshipTypeLabel(link)
  const identity = isKnownResourceType(link.resource_type) ? (
    <ResourceIdentity
      context={relationshipTypeLabel}
      kind={link.resource_type}
      name={label}
      nameContent={
        link.resource_type === "sample" || link.resource_type === "dataset" ? (
          <ResourceNameLink
            kind={link.resource_type}
            mfid={link.unique_id}
            name={label}
            navigation="preview"
          />
        ) : undefined
      }
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
    <ResourceListItem className={className}>
      <ResourceListItemContent className="px-0">
        <div className="min-w-0 flex-1">{identity}</div>
        <div className="flex shrink-0 items-center">
          {managing ? (
            renderManagementAction?.(link)
          ) : isKnownResourceType(link.resource_type) ? (
            <ResourceFullPageLink
              kind={link.resource_type}
              mfid={link.unique_id}
              name={relationshipDisplayName(link)}
              presentation="table"
            />
          ) : null}
        </div>
      </ResourceListItemContent>
    </ResourceListItem>
  )
}

function isKnownResourceType(
  value: string
): value is "dataset" | "instrument" | "project" | "sample" {
  return ["dataset", "instrument", "project", "sample"].includes(value)
}
