import { useHydrated } from "@tanstack/react-router"

import {
  formatRecentActivity,
  formatUtcDateTime,
  formatZonedLocalDateTime,
} from "@/lib/format"
import { cn } from "@/lib/utils"

export function ActivityTime({
  className,
  fallback,
  value,
}: {
  className?: string
  fallback: string
  value: string | null | undefined
}) {
  const hydrated = useHydrated()
  if (!value) {
    return (
      <span className={cn("text-muted-foreground", className)}>{fallback}</span>
    )
  }
  return (
    <time
      className={cn("tabular-nums", className)}
      dateTime={value}
      title={
        (hydrated
          ? formatZonedLocalDateTime(value)
          : formatUtcDateTime(value)) ?? undefined
      }
    >
      {hydrated
        ? formatRecentActivity(value)
        : (formatUtcDateTime(value) ?? fallback)}
    </time>
  )
}
