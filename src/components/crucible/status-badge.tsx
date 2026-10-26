import { Badge } from "@/components/ui/badge"
import { statusLabel, statusTone } from "@/lib/status"
import type { StatusDomain } from "@/lib/status"

export function StatusBadge({
  className,
  domain = "resource",
  status,
}: {
  className?: string
  domain?: StatusDomain
  status: string
}) {
  return (
    <Badge className={className} variant={statusTone(domain, status)}>
      {statusLabel(domain, status)}
    </Badge>
  )
}
