import { Badge } from "@/components/ui/badge"
import { instrumentStatusLabel } from "@/data/crucible/instrument-status"

function instrumentStatusVariant(status: string) {
  if (status === "decommissioned") return "destructive" as const
  if (status === "maintenance") return "warning" as const
  if (status === "active") return "success" as const
  return "outline" as const
}

export function InstrumentStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={instrumentStatusVariant(status)}>
      {instrumentStatusLabel(status)}
    </Badge>
  )
}
