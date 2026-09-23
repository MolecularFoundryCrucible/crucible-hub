import type { MouseEventHandler, ReactElement } from "react"
import { Link } from "@tanstack/react-router"

import { OpenFullPageIcon } from "@/components/crucible/icons"
import { ResourceName } from "@/components/crucible/resource-name"
import { isPlainPreviewNavigation } from "@/components/crucible/resource-preview-navigation"
import { useResourceSiblingCandidate } from "@/components/crucible/resource-sibling-navigation"
import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type ResourceFullPageKind = "dataset" | "instrument" | "project" | "sample"
type ResourceFullPagePresentation = "inspector-footer" | "name" | "table"

export function ResourceFullPageLink({
  className,
  fromProject,
  kind,
  mfid,
  name,
  onClick,
  presentation,
}: {
  className?: string
  fromProject?: string
  kind?: ResourceFullPageKind
  mfid: string
  name: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  presentation: ResourceFullPagePresentation
}) {
  const siblingCandidate = useResourceSiblingCandidate(mfid, kind)
  const actionLabel = `Open full page: ${name}`
  const linkClassName = cn(
    presentation === "name"
      ? "block min-w-0 rounded-sm text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      : buttonVariants(
          presentation === "table"
            ? { size: "table-action", variant: "outline" }
            : { variant: "outline" }
        ),
    className
  )
  const children =
    presentation === "name" ? (
      name
    ) : presentation === "inspector-footer" ? (
      <>
        Open
        <OpenFullPageIcon aria-hidden="true" data-icon="inline-end" />
      </>
    ) : (
      <OpenFullPageIcon aria-hidden="true" />
    )
  const common = {
    "aria-label": actionLabel,
    className: linkClassName,
    children,
    draggable: presentation === "name" ? false : undefined,
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      if (
        presentation === "name" &&
        hasSelectedText(event.currentTarget, event.detail)
      ) {
        event.preventDefault()
        return
      }
      if (
        !event.defaultPrevented &&
        isPlainPreviewNavigation({
          altKey: event.altKey,
          button: event.button,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          target: event.currentTarget.target,
        })
      ) {
        siblingCandidate.start()
      }
    },
    preload: false as const,
    state: siblingCandidate.sessionId
      ? { resourceSiblingSession: siblingCandidate.sessionId }
      : {},
  }
  let link: ReactElement

  if (kind === "project") {
    link = (
      <Link
        {...common}
        params={{ projectMfid: mfid }}
        search={{ preview: undefined }}
        to="/projects/$projectMfid"
      />
    )
  } else if (kind === "instrument") {
    link = (
      <Link
        {...common}
        params={{ instrumentMfid: mfid }}
        search={{}}
        to="/instruments/$instrumentMfid"
      />
    )
  } else if (kind === "sample") {
    link = (
      <Link
        {...common}
        params={{ sampleMfid: mfid }}
        search={{ fromProject, preview: undefined }}
        to="/samples/$sampleMfid"
      />
    )
  } else if (kind === "dataset") {
    link = (
      <Link
        {...common}
        params={{ datasetMfid: mfid }}
        search={{ fromProject, preview: undefined }}
        to="/datasets/$datasetMfid"
      />
    )
  } else {
    link = (
      <Link
        {...common}
        params={{ resourceMfid: mfid }}
        search={{ preview: undefined }}
        to="/resources/$resourceMfid"
      />
    )
  }

  if (presentation === "inspector-footer" || presentation === "name")
    return link

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent>
        Open full page: <ResourceName>{name}</ResourceName>
      </TooltipContent>
    </Tooltip>
  )
}

function hasSelectedText(target: HTMLAnchorElement, eventDetail: number) {
  if (eventDetail === 0) return false
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return false
  return Boolean(
    (selection.anchorNode && target.contains(selection.anchorNode)) ||
    (selection.focusNode && target.contains(selection.focusNode))
  )
}

export type { ResourceFullPageKind, ResourceFullPagePresentation }
