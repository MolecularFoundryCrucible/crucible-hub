import { Collapsible } from "@base-ui/react/collapsible"
import { useRef } from "react"
import type { ReactElement, ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Shows or hides content by animating its height and opacity. While closing it
 * keeps the last open content, so the exit animates even when the caller stops
 * rendering that content at the same moment.
 */
export function Reveal({
  children,
  className,
  open,
  render,
}: {
  children: ReactNode
  className?: string
  open: boolean
  render?: ReactElement
}) {
  const lastOpenChildren = useRef(children)
  if (open) lastOpenChildren.current = children
  return (
    <Collapsible.Root open={open} render={render}>
      <Collapsible.Panel className={cn("reveal-panel", className)}>
        {open ? children : lastOpenChildren.current}
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
