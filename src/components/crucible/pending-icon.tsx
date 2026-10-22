import type { ComponentProps } from "react"

import { SavingChangesIcon } from "@/components/crucible/icons"
import { useDelayedFlag } from "@/hooks/use-delayed-flag"
import { cn } from "@/lib/utils"

export function PendingIcon({
  className,
  label,
  ...props
}: Omit<
  ComponentProps<typeof SavingChangesIcon>,
  "aria-hidden" | "aria-label"
> & {
  label?: string
}) {
  return (
    <SavingChangesIcon
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("motion-safe:animate-spin", className)}
      {...props}
    />
  )
}

/** A pending spinner that appears only after the indicator delay. */
export function DelayedPendingIcon({
  pending,
  ...props
}: ComponentProps<typeof PendingIcon> & { pending: boolean }) {
  return useDelayedFlag(pending) ? <PendingIcon {...props} /> : null
}
