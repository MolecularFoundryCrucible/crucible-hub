import { Badge } from "@/components/ui/badge"

export function resourceStatusVariant(status: string) {
  const normalized = status
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, " ")
  switch (normalized) {
    case "active":
    case "ready":
    case "approved":
      return "success" as const
    case "maintenance":
    case "pending":
    case "degraded":
      return "warning" as const
    case "decommissioned":
    case "rejected":
    case "failed":
    case "error":
      return "destructive" as const
    case "archived":
    case "draft":
    case "completed":
    case "closed":
      return "secondary" as const
    default:
      return "outline" as const
  }
}

export function resourceStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase()
  switch (normalized) {
    case "active":
      return "Active"
    case "maintenance":
      return "Maintenance"
    case "decommissioned":
      return "Decommissioned"
    case "archived":
      return "Archived"
    case "pending":
      return "Pending"
    case "draft":
      return "Draft"
    case "completed":
      return "Completed"
    default:
      if (!status) return status
      return status
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map(
          (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        )
        .join(" ")
  }
}

export function ResourceStatusBadge({
  className,
  status,
}: {
  className?: string
  status: string
}) {
  return (
    <Badge className={className} variant={resourceStatusVariant(status)}>
      {resourceStatusLabel(status)}
    </Badge>
  )
}
