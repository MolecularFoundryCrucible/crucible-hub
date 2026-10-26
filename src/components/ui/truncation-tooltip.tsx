import * as React from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function truncated(element: HTMLElement | null) {
  return Boolean(element && element.scrollWidth > element.clientWidth)
}

/**
 * Shows the full text of a truncated element on hover or keyboard focus, and
 * stays closed while the text fits.
 */
function TruncationTooltip({
  children,
  label,
}: {
  children: React.ReactElement
  label: string
}) {
  const trigger = React.useRef<HTMLButtonElement>(null)
  return (
    <Tooltip
      onOpenChange={(open, details) => {
        if (open && !truncated(trigger.current)) details.cancel()
      }}
    >
      <TooltipTrigger ref={trigger} render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export { TruncationTooltip }
