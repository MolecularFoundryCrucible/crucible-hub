import { useHydrated } from "@tanstack/react-router"

import { formatDate, formatUtcDateTime } from "@/lib/format"

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
    <time className={className} dateTime={value}>
      {hydrated ? formatDate(value) : (formatUtcDateTime(value) ?? fallback)}
    </time>
  )
}
