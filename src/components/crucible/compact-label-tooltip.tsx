import { useRef } from "react"
import type { ReactElement } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** Marks the visible label of an action that shortens to an icon. */
export const compactLabelProps = { "data-compact-label": "" }

function labelShown(trigger: HTMLElement | null) {
  const label = trigger?.querySelector("[data-compact-label]")
  return Boolean(label && label.getBoundingClientRect().width > 1)
}

/**
 * Names an action in a tooltip only while its label is hidden, so the
 * container queries that shorten the action stay the single source of truth.
 */
export function CompactLabelTooltip({
  children,
  label,
}: {
  children: ReactElement
  label: string
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <Tooltip
      onOpenChange={(open, details) => {
        if (open && labelShown(trigger.current)) details.cancel()
      }}
    >
      <TooltipTrigger ref={trigger} render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
