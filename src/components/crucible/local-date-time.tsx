import { useHydrated } from "@tanstack/react-router"

import { useViewerPresentation } from "@/hooks/use-viewer-presentation"
import {
  formatCalendarDate,
  formatDate,
  formatDateInZone,
  formatUtcDateTime,
} from "@/lib/format"
import { cn } from "@/lib/utils"

export function LocalDateTime({
  className,
  dateOnly = false,
  fallback = "Unknown",
  value,
}: {
  className?: string
  dateOnly?: boolean
  fallback?: string
  value: string | null | undefined
}) {
  const hydrated = useHydrated()
  const { timeZone } = useViewerPresentation()
  if (!value) return <>{fallback}</>
  if (dateOnly) {
    return (
      <time className={cn("tabular-nums", className)} dateTime={value}>
        {formatCalendarDate(
          value,
          timeZone ?? (hydrated ? undefined : "UTC")
        ) ?? fallback}
      </time>
    )
  }
  return (
    <time className={cn("tabular-nums", className)} dateTime={value}>
      {timeZone
        ? formatDateInZone(value, timeZone)
        : hydrated
          ? formatDate(value)
          : (formatUtcDateTime(value) ?? fallback)}
    </time>
  )
}
