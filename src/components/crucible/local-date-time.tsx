import { useHydrated } from "@tanstack/react-router"

import { useViewerPresentation } from "@/hooks/use-viewer-presentation"
import { formatDate, formatDateInZone, formatUtcDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export function LocalDateTime({
  className,
  fallback = "Unknown",
  value,
}: {
  className?: string
  fallback?: string
  value: string | null | undefined
}) {
  const hydrated = useHydrated()
  const { timeZone } = useViewerPresentation()
  if (!value) return <>{fallback}</>
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
