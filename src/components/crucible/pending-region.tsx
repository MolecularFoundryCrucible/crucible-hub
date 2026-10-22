import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

/**
 * A region whose content is being reloaded: it stays readable and dims after
 * the indicator delay (decision 0036).
 */
export function PendingRegion({
  as: Element = "div",
  className,
  pending,
  ...props
}: ComponentProps<"div"> & {
  as?: "div" | "main" | "section"
  pending: boolean
}) {
  return (
    <Element
      aria-busy={pending || undefined}
      className={cn("pending-region", className)}
      data-pending={pending || undefined}
      {...props}
    />
  )
}
