import { DeletionRequestedIcon } from "@/components/crucible/icons"
import { Badge } from "@/components/ui/badge"
import type { WorkspaceDeletionRequestStatus } from "@/data/crucible/deletion-requests.server"

export function ResourceDeletionRequestBadge({
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
      <DeletionRequestedIcon aria-hidden="true" data-icon="inline-start" />
      {status === "approved"
        ? "Deletion approved"
        : status === "rejected"
          ? "Deletion rejected"
          : "Deletion pending"}
    </Badge>
  )
}
