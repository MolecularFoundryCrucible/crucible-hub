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
