import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"
import {
  clearSystemStatusCache,
  readFixtureSystemStatus,
  readSystemStatus,
} from "./system-status.server"

describe("system-status server source", () => {
  beforeEach(() => {
    clearSystemStatusCache()
  })

  afterEach(() => {
    clearSystemStatusCache()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("returns fixture system status in fixture mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const status = await readSystemStatus()

    expect(status.status).toBe("ok")
    expect(status.api.status).toBe("ok")
    expect(status.api.url).toBeUndefined()
    expect(status.api.version).toBe("0.1.0-fixture")
    expect(status.database.status).toBe("ok")
    expect(status.database.schemaRevisions).toContain("20260401_01_fixture")
  })

  it("returns fixture details directly via readFixtureSystemStatus", () => {
    const fixture = readFixtureSystemStatus()

    expect(fixture.status).toBe("ok")
    expect(fixture.api.status).toBe("ok")
    expect(fixture.database.status).toBe("ok")
  })

  it("reads healthy system status from API endpoint", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    const fetchMock = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/health/ready")
      expect(request.headers.get("Crucible-Privilege-Mode")).toBeNull()
      return Response.json({
        status: "ok",
        build: {
          api_version: "1.2.3",
          git_commit: "abc1234",
          branch: "main",
        },
        database: {
          status: "ok",
          latency_ms: 4,
          schema_revisions: ["rev1", "rev2"],
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const status = await readSystemStatus(undefined, true)

    expect(status.status).toBe("ok")
    expect(status.api.status).toBe("ok")
    expect(status.api.url).toBe("https://api.example.test")
    expect(status.api.version).toBe("1.2.3")
    expect(status.api.commit).toBe("abc1234")
    expect(status.database.status).toBe("ok")
    expect(status.database.latencyMs).toBe(4)
    expect(status.database.schemaRevisions).toEqual(["rev1", "rev2"])
  })

  it("handles 503 degraded API responses", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    const fetchMock = vi.fn(async () => {
      return Response.json(
        {
          status: "degraded",
          build: {
            api_version: "1.2.3",
            git_commit: "abc1234",
            branch: "main",
          },
          database: {
            status: "error",
            latency_ms: null,
            schema_revisions: [],
          },
        },
        { status: 503 }
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const status = await readSystemStatus(undefined, true)

    expect(status.status).toBe("degraded")
    expect(status.api.status).toBe("degraded")
    expect(status.api.url).toBe("https://api.example.test")
    expect(status.database.status).toBe("error")
  })

  it("handles network unreachable errors safely", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    const fetchMock = vi.fn(async () => {
      throw new Error("Connection refused")
    })
    vi.stubGlobal("fetch", fetchMock)

    const status = await readSystemStatus(undefined, true)

    expect(status.status).toBe("unreachable")
    expect(status.api.status).toBe("unreachable")
    expect(status.api.url).toBe("https://api.example.test")
    expect(status.database.status).toBe("unknown")
  })

  it("returns unreachable status without probing when hub-auth has no API URL", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "hub-auth")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "")

    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const status = await readSystemStatus(undefined, true)

    expect(status.status).toBe("unreachable")
    expect(status.api.url).toBeUndefined()
    expect(status.database.status).toBe("unknown")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("probes readiness without the signed-in session in hub-auth mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "hub-auth")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")

    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request) => {
        requests.push(input)
        return Response.json({
          status: "ok",
          build: { api_version: "3.1.0" },
          database: { status: "ok", latency_ms: 2, schema_revisions: [] },
        })
      })
    )

    const status = await readSystemStatus(undefined, true)

    expect(status.api.status).toBe("ok")
    expect(new URL(requests[0].url).pathname).toBe("/health/ready")
    expect(requests[0].headers.get("authorization")).toBeNull()
  })

  it("caches status and reuses it until bypassCache is requested", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    let callCount = 0
    const fetchMock = vi.fn(async () => {
      callCount += 1
      return crucibleApiResponse({
        status: "ok",
        build: {
          api_version: `1.0.${callCount}`,
          git_commit: "commit",
          branch: "main",
        },
        database: {
          status: "ok",
          latency_ms: 2,
          schema_revisions: [],
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const first = await readSystemStatus(undefined, true)
    expect(first.api.version).toBe("1.0.1")
    expect(callCount).toBe(1)

    const second = await readSystemStatus(undefined, false)
    expect(second.api.version).toBe("1.0.1")
    expect(callCount).toBe(1)

    const third = await readSystemStatus(undefined, true)
    expect(third.api.version).toBe("1.0.2")
    expect(callCount).toBe(2)
  })
})
