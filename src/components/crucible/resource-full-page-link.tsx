import type { MouseEventHandler, ReactElement } from "react"
import { Link } from "@tanstack/react-router"

import { OpenFullPageIcon } from "@/components/crucible/icons"
import { ResourceName } from "@/components/crucible/resource-name"
import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type ResourceFullPageKind = "dataset" | "instrument" | "project" | "sample"
type ResourceFullPagePresentation = "inspector-footer" | "table"

export function ResourceFullPageLink({
  kind,
  mfid,
  name,
  onClick,
  presentation,
}: {
  kind?: ResourceFullPageKind
  mfid: string
  name: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  presentation: ResourceFullPagePresentation
}) {
  const actionLabel = `Open full page: ${name}`
  const className = buttonVariants(
    presentation === "table"
      ? { size: "icon-sm", variant: "outline" }
      : { variant: "outline" }
  )
  const children =
    presentation === "inspector-footer" ? (
      <>
        Open
        <OpenFullPageIcon aria-hidden="true" data-icon="inline-end" />
      </>
    ) : (
      <OpenFullPageIcon aria-hidden="true" />
    )
  const common = {
    "aria-label": actionLabel,
    className,
    children,
    onClick,
    preload: false as const,
    state: {},
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
        search={{ preview: undefined }}
        to="/samples/$sampleMfid"
      />
    )
  } else if (kind === "dataset") {
    link = (
      <Link
        {...common}
        params={{ datasetMfid: mfid }}
        search={{ preview: undefined }}
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

  if (presentation === "inspector-footer") return link

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent>
        Open full page: <ResourceName>{name}</ResourceName>
      </TooltipContent>
    </Tooltip>
  )
}

export type { ResourceFullPageKind, ResourceFullPagePresentation }
