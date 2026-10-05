export type ServiceStatus = "ok" | "degraded" | "unreachable"

export interface SystemStatus {
  status: ServiceStatus
  hub: {
    revision?: string
  }
  api: {
    status: ServiceStatus
    version?: string
    commit?: string
    branch?: string
    latencyMs?: number
  }
  database: {
    status: "ok" | "error" | "unknown"
    latencyMs?: number | null
    schemaRevisions: string[]
  }
  timestamp: string
}
