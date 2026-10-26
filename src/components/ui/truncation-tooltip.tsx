import * as React from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

function cutOff(element: Element) {
  const style = getComputedStyle(element)
  const clamps =
    style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none"
  return (
    clamps &&
    (element.scrollWidth > element.clientWidth + 1 ||
      element.scrollHeight > element.clientHeight + 1)
  )
}

function truncated(element: HTMLElement | null) {
  return Boolean(
    element && [element, ...element.querySelectorAll("*")].some(cutOff)
  )
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

/**
 * Text that may be cut off by its own `truncate` or `line-clamp` classes, or
 * by a child's; its full `label` (string children by default, none when
 * null) shows in a TruncationTooltip only while it is cut off.
 */
function TruncatedText({
  children,
  className,
  label,
  ...props
}: React.ComponentProps<"span"> & { label?: string | null }) {
  const text =
    label === undefined
      ? typeof children === "string"
        ? children
        : undefined
      : label
  const span = (
    <span
      className={cn("min-w-0", className)}
      data-slot="truncated-text"
      {...props}
    >
      {children}
    </span>
  )
  return text ? (
    <TruncationTooltip label={text}>{span}</TruncationTooltip>
  ) : (
    span
  )
}

export { TruncatedText, TruncationTooltip }
