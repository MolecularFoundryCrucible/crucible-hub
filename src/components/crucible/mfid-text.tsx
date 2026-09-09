import { cn } from "@/lib/utils"

export function MfidText({
  className,
  value,
}: {
  className?: string
  value: string
}) {
  return (
    <span className={cn("font-mono text-identifier", className)}>{value}</span>
  )
}
