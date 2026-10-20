import type { MouseEventHandler } from "react"
import { Link } from "@tanstack/react-router"

import { ResourceGraphIcon } from "@/components/crucible/icons"
import { ResourceName } from "@/components/crucible/resource-name"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"
import { cn } from "@/lib/utils"
import { resourceGraphWarmupProps } from "./resource-graph-warmup"

export function ResourceGraphLink({
  kind,
  mfid,
  name,
  onClick,
  presentation = "card-action",
}: {
  kind: WorkspaceResourceDetail["kind"] | undefined
  mfid: string
  name?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  presentation?: "card-action" | "inspector-footer"
}) {
  const children = (
    <>
      <ResourceGraphIcon aria-hidden="true" data-icon="inline-start" />
      Graph
    </>
  )

  if (presentation === "inspector-footer") {
    if (kind === "sample") {
      return (
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          onClick={onClick}
          params={{ sampleMfid: mfid }}
          preload={false}
          search={{ preview: undefined }}
          state={{}}
          {...resourceGraphWarmupProps}
          to="/samples/$sampleMfid/graph"
        >
          {children}
        </Link>
      )
    }
    if (kind === "dataset") {
      return (
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          onClick={onClick}
          params={{ datasetMfid: mfid }}
          preload={false}
          search={{ preview: undefined }}
          state={{}}
          {...resourceGraphWarmupProps}
          to="/datasets/$datasetMfid/graph"
        >
          {children}
        </Link>
      )
    }
    return (
      <Button className="w-full" disabled type="button" variant="outline">
        {children}
      </Button>
    )
  }

  const labelName = name ?? mfid
  const ariaLabel = `Explore graph for ${labelName}`
  const className = buttonVariants({ size: "sm", variant: "ghost" })
  const link =
    kind === "sample" ? (
      <Link
        aria-label={ariaLabel}
        className={className}
        onClick={onClick}
        params={{ sampleMfid: mfid }}
        preload={false}
        search={{ preview: undefined }}
        {...resourceGraphWarmupProps}
        to="/samples/$sampleMfid/graph"
      />
    ) : kind === "dataset" ? (
      <Link
        aria-label={ariaLabel}
        className={className}
        onClick={onClick}
        params={{ datasetMfid: mfid }}
        preload={false}
        search={{ preview: undefined }}
        {...resourceGraphWarmupProps}
        to="/datasets/$datasetMfid/graph"
      />
    ) : null

  if (!link) return null

  return (
    <Tooltip>
      <TooltipTrigger render={link}>{children}</TooltipTrigger>
      <TooltipContent>
        Explore graph for <ResourceName>{labelName}</ResourceName>
      </TooltipContent>
    </Tooltip>
  )
}
