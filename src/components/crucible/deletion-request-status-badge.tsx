import { Badge } from "@/components/ui/badge"
import type { WorkspaceDeletionRequestStatus } from "@/data/crucible/deletion-requests.server"

export function DeletionRequestStatusBadge({
  status,
}: {
  status: WorkspaceDeletionRequestStatus
}) {
  return (
    <Badge
      variant={
        status === "approved"
          ? "success"
          : status === "rejected"
            ? "destructive"
            : "warning"
      }
    >
      {status === "approved"
        ? "Approved"
        : status === "rejected"
          ? "Rejected"
          : "Pending"}
    </Badge>
  )
}
