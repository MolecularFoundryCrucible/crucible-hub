import type { ComponentProps } from "react"

import {
  CompactLabelTooltip,
  compactLabelProps,
} from "@/components/crucible/compact-label-tooltip"
import { RefreshResourceIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"

export function RefreshButton({
  compactTooltip = true,
  failed = false,
  label,
  onClick,
  refreshing,
  size,
}: {
  /** Name the action in a tooltip while it shows only its icon. */
  compactTooltip?: boolean
  failed?: boolean
  label?: string
  onClick: () => void
  refreshing: boolean
  size?: ComponentProps<typeof Button>["size"]
}) {
  const button = (
    <Button
      aria-busy={refreshing || undefined}
      aria-label={label ?? "Refresh"}
      data-refreshing={refreshing || undefined}
      onClick={refreshing ? undefined : onClick}
      size={size}
      type="button"
      variant={failed ? "destructive" : "ghost"}
    >
      <RefreshResourceIcon
        aria-hidden="true"
        className={refreshing ? "motion-safe:animate-spin" : undefined}
        data-icon="inline-start"
      />
      {size === undefined ? (
        <span className="@max-labels/content:sr-only" {...compactLabelProps}>
          Refresh
        </span>
      ) : (
        "Refresh"
      )}
    </Button>
  )
  return size === undefined && compactTooltip ? (
    <CompactLabelTooltip label="Refresh">{button}</CompactLabelTooltip>
  ) : (
    button
  )
}
