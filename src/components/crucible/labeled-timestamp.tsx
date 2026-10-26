import { ActivityTime } from "@/components/crucible/activity-time"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { cn } from "@/lib/utils"

export function LabeledTimestamp({
  className,
  fallback = "None yet",
  label,
  presentation = "date",
  value,
}: {
  className?: string
  fallback?: string
  label: string
  presentation?: "activity" | "date"
  value: string | null | undefined
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-baseline gap-x-1.5 text-supporting @fields:block @fields:text-right",
        className
      )}
    >
      <span className="text-muted-foreground @fields:block">{label}</span>
      {presentation === "activity" ? (
        <ActivityTime
          className="@fields:block"
          fallback={fallback}
          value={value}
        />
      ) : (
        <LocalDateTime
          className="@fields:block"
          fallback={fallback}
          value={value}
        />
      )}
    </div>
  )
}
