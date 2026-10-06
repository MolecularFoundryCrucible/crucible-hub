import "@tanstack/react-start/server-only"

import { createCrucibleClient } from "@/server/crucible/client.server"
import { crucibleRequestSignal } from "@/server/crucible/request-signal.server"
import type { SystemStatus } from "./system-status"
import { readWorkspaceConfiguration } from "./workspace-config.server"

const CACHE_TTL_MS = 15_000
let cachedStatus: { status: SystemStatus; expiresAt: number } | null = null

export function clearSystemStatusCache() {
  cachedStatus = null
}

export function readFixtureSystemStatus(): SystemStatus {
  return {
    status: "ok",
    hub: {
      revision: process.env.VITE_GIT_COMMIT || undefined,
    },
    api: {
      status: "ok",
      version: "0.1.0-fixture",
      commit: "fixture-head",
      branch: "main",
      latencyMs: 1,
    },
    database: {
      status: "ok",
      latencyMs: 1,
      schemaRevisions: ["20260401_01_fixture"],
    },
    timestamp: new Date().toISOString(),
  }
}

function unreachableStatus(latencyMs?: number): SystemStatus {
  return {
    status: "unreachable",
    hub: {
      revision: process.env.VITE_GIT_COMMIT || undefined,
    },
    api: {
      status: "unreachable",
      latencyMs,
    },
    database: {
      status: "unknown",
      latencyMs: null,
      schemaRevisions: [],
    },
    timestamp: new Date().toISOString(),
  }
}

export async function readSystemStatus(
  requestSignal?: AbortSignal,
  bypassCache = false
): Promise<SystemStatus> {
  const now = Date.now()
  if (!bypassCache && cachedStatus && now < cachedStatus.expiresAt) {
    return cachedStatus.status
  }

  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "fixture") {
    const fixture = readFixtureSystemStatus()
    cachedStatus = { status: fixture, expiresAt: now + CACHE_TTL_MS }
    return fixture
  }

  if (configuration.mode === "unavailable") {
    const unavailableStatus = unreachableStatus()
    return unavailableStatus
  }

  if (!configuration.baseUrl) {
    const unavailableStatus = unreachableStatus()
    return unavailableStatus
  }

  const client = createCrucibleClient(
    {
      baseUrl: configuration.baseUrl,
      bearerToken: configuration.bearerToken,
      fetch: configuration.fetch,
    },
    { privilegeMode: null }
  )

  const startTime = Date.now()
  try {
    const result = await client.GET("/health/ready", {
      signal: crucibleRequestSignal(requestSignal),
    })
    const latencyMs = Math.round(Date.now() - startTime)

    if (result.data) {
      const status: SystemStatus = {
        status: result.data.status,
        hub: {
          revision: process.env.VITE_GIT_COMMIT || undefined,
        },
        api: {
          status: result.data.status,
          version: result.data.build.api_version,
          commit: result.data.build.git_commit ?? undefined,
          branch: result.data.build.branch ?? undefined,
          latencyMs,
        },
        database: {
          status: result.data.database.status,
          latencyMs: result.data.database.latency_ms,
          schemaRevisions: result.data.database.schema_revisions,
        },
        timestamp: new Date().toISOString(),
      }
      cachedStatus = { status, expiresAt: Date.now() + CACHE_TTL_MS }
      return status
    }

    const errorPayload = result.error as unknown
    if (
      typeof errorPayload === "object" &&
      errorPayload !== null &&
      "database" in errorPayload
    ) {
      const errorData = result.error as {
        status?: "ok" | "degraded"
        build?: {
          api_version?: string
          git_commit?: string | null
          branch?: string | null
        }
        database?: {
          status?: "ok" | "error"
          latency_ms?: number | null
          schema_revisions?: string[]
        }
      }
      const status: SystemStatus = {
        status: "degraded",
        hub: {
          revision: process.env.VITE_GIT_COMMIT || undefined,
        },
        api: {
          status: "degraded",
          version: errorData.build?.api_version,
          commit: errorData.build?.git_commit ?? undefined,
          branch: errorData.build?.branch ?? undefined,
          latencyMs,
        },
        database: {
          status: errorData.database?.status ?? "error",
          latencyMs: errorData.database?.latency_ms ?? null,
          schemaRevisions: errorData.database?.schema_revisions ?? [],
        },
        timestamp: new Date().toISOString(),
      }
      cachedStatus = { status, expiresAt: Date.now() + CACHE_TTL_MS }
      return status
    }

    const status = unreachableStatus(latencyMs)
    cachedStatus = { status, expiresAt: Date.now() + CACHE_TTL_MS }
    return status
  } catch {
    const status = unreachableStatus(Math.round(Date.now() - startTime))
    cachedStatus = { status, expiresAt: Date.now() + CACHE_TTL_MS }
    return status
  }
}
