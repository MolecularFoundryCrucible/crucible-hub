import type { ComponentProps } from "react"

import { DisclosureIcon } from "@/components/crucible/icons"
import { cn } from "@/lib/utils"

/** A native disclosure whose content animates open and closed. */
export function Disclosure({ className, ...props }: ComponentProps<"details">) {
  return (
    <details
      className={cn("disclosure min-w-0", className)}
      data-slot="disclosure"
      {...props}
    />
  )
}

export function DisclosureSummary({
  children,
  className,
  ...props
}: ComponentProps<"summary">) {
  return (
    <summary
      className={cn(
        "disclosure-summary rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
      data-slot="disclosure-summary"
      {...props}
    >
      <DisclosureIcon aria-hidden="true" className="disclosure-icon" />
      {children}
    </summary>
  )
}
