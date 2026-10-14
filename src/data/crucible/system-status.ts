export type ServiceStatus = "ok" | "degraded" | "unreachable"

export interface SystemStatus {
  status: ServiceStatus
  hub: {
    revision?: string
    version: string
  }
  api: {
    status: ServiceStatus
    url?: string
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
