import { Badge } from "@/components/ui/badge"
import { instrumentStatusLabel } from "@/data/crucible/instrument-status"

function instrumentStatusVariant(status: string) {
  if (status === "decommissioned") return "destructive" as const
  if (status === "maintenance") return "outline" as const
  return "secondary" as const
}

export function InstrumentStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={instrumentStatusVariant(status)}>
      {instrumentStatusLabel(status)}
    </Badge>
  )
}
