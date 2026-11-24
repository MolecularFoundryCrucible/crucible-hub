import { z } from "zod"
import { resourcePreviewSearchSchema } from "@/components/crucible/resource-preview-navigation"
import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import type { WorkspaceDeletionRequestSort } from "@/data/crucible/workspace-source"

export const deletionRequestSearchSchema = z
  .object({
    direction: z.enum(["asc", "desc"]).optional().catch(undefined),
    projectMfid: z.string().trim().min(1).max(255).optional().catch(undefined),
    sort: z
      .enum([
        "project_id",
        "request_time",
        "requester_name",
        "resource_name",
        "status",
      ])
      .optional()
      .catch(undefined),
    view: z
      .enum(["approved", "reviewable", "submitted"])
      .optional()
      .catch(undefined),
  })
  .merge(resourcePreviewSearchSchema)

export function defaultDeletionRequestDirection(
  sort: WorkspaceDeletionRequestSort
) {
  if (sort !== "request_time") return "asc" as const
  return "desc" as const
}

export function deletionRequestScope(
  view: "approved" | "reviewable" | "submitted"
) {
  return view === "reviewable" ? "reviewable" : "submitted"
}

export function deletionAuditScope(privilegeMode: WorkspacePrivilegeMode) {
  return privilegeMode === "elevated"
    ? ("all" as const)
    : ("submitted" as const)
}

export function deletionRequestStatus(
  view: "approved" | "reviewable" | "submitted"
) {
  if (view === "reviewable") return "pending" as const
  return undefined
}
