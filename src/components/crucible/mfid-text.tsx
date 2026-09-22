import { cn } from "@/lib/utils"

export function MfidText({
  className,
  presentation = "default",
  value,
}: {
  className?: string
  presentation?: "default" | "supporting"
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
    >
      {value}
    </span>
  )
}
