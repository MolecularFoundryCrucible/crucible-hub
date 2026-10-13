import type { ComponentProps } from "react"

import { RefreshResourceIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"

export function RefreshButton({
  failed = false,
  label,
  onClick,
  refreshing,
  size,
}: {
  failed?: boolean
  label?: string
  onClick: () => void
  refreshing: boolean
  size?: ComponentProps<typeof Button>["size"]
}) {
  return (
    <Button
      aria-busy={refreshing || undefined}
      aria-label={label}
      className={refreshing ? "translate-y-px" : undefined}
      data-refreshing={refreshing || undefined}
      onClick={refreshing ? undefined : onClick}
      size={size}
      type="button"
      variant={failed ? "destructive" : "outline"}
    >
      <RefreshResourceIcon
        aria-hidden="true"
        className={refreshing ? "motion-safe:animate-spin" : undefined}
        data-icon="inline-start"
      />
      Refresh
    </Button>
  )
}
