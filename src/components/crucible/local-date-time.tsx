import { useHydrated } from "@tanstack/react-router"

import { formatDate, formatUtcDateTime } from "@/lib/format"
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
  if (!value) return <>{fallback}</>
  return (
    <time className={cn("tabular-nums", className)} dateTime={value}>
      {hydrated ? formatDate(value) : (formatUtcDateTime(value) ?? fallback)}
    </time>
  )
}
