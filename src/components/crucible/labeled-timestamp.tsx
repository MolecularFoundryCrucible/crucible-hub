import { ActivityTime } from "@/components/crucible/activity-time"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { cn } from "@/lib/utils"

export function LabeledTimestamp({
  className,
  fallback = "None yet",
  label,
  layout = "adaptive",
  presentation = "date",
  value,
}: {
  className?: string
  fallback?: string
  label: string
  /** `stacked` keeps the label above the time for rows that never stack. */
  layout?: "adaptive" | "stacked"
  presentation?: "activity" | "date"
  value: string | null | undefined
}) {
  const block = layout === "stacked" ? "block" : "@fields:block"
  return (
    <div
      className={cn(
        layout === "stacked"
          ? "block shrink-0 text-right text-supporting"
          : "flex shrink-0 flex-wrap items-baseline gap-x-1.5 text-supporting @fields:block @fields:text-right",
        className
      )}
    >
      <span className={cn("text-muted-foreground", block)}>{label}</span>
      {presentation === "activity" ? (
        <ActivityTime className={block} fallback={fallback} value={value} />
      ) : (
        <LocalDateTime className={block} fallback={fallback} value={value} />
      )}
    </div>
  )
}
