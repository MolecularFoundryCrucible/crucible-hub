import { cn } from "@/lib/utils"

export function MfidText({
  className,
  presentation = "default",
  title,
  value,
}: {
  className?: string
  presentation?: "default" | "supporting"
  title?: string
  value: string
}) {
  return (
    <span
      className={cn(
        "font-mono",
        presentation === "supporting"
          ? "text-supporting text-muted-foreground"
          : "text-identifier",
        className
      )}
      title={title}
    >
      {value}
    </span>
  )
}
