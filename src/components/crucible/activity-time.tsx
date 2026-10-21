import { useHydrated } from "@tanstack/react-router"

import {
  formatRecentActivity,
  formatUtcDateTime,
  formatZonedDateTimeInZone,
  formatZonedLocalDateTime,
} from "@/lib/format"
import { useViewerPresentation } from "@/hooks/use-viewer-presentation"
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
  const { timeZone } = useViewerPresentation()
  if (!value) {
    return (
      <span className={cn("text-muted-foreground", className)}>{fallback}</span>
    )
  }
  return (
    <time
      className={cn("tabular-nums", className)}
      dateTime={value}
      suppressHydrationWarning
      title={
        (timeZone
          ? formatZonedDateTimeInZone(value, timeZone)
          : hydrated
            ? formatZonedLocalDateTime(value)
            : formatUtcDateTime(value)) ?? undefined
      }
    >
      {timeZone
        ? formatRecentActivity(value, new Date(), timeZone)
        : hydrated
          ? formatRecentActivity(value)
          : (formatUtcDateTime(value) ?? fallback)}
    </time>
  )
}
