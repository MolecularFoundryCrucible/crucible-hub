import type { WorkspaceInstrumentStatus } from "./workspace-source"

export const instrumentStatuses = [
  "active",
  "maintenance",
  "decommissioned",
] as const satisfies readonly WorkspaceInstrumentStatus[]

export function isWorkspaceInstrumentStatus(
  value: unknown
): value is WorkspaceInstrumentStatus {
  return instrumentStatuses.some((status) => status === value)
}

export function instrumentStatusLabel(status: string) {
  if (status === "active") return "Active"
  if (status === "maintenance") return "Maintenance"
  if (status === "decommissioned") return "Decommissioned"
  return status
}
