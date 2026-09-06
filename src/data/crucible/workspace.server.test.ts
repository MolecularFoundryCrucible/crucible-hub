import { afterEach, describe, expect, it, vi } from "vitest"

import { readWorkspace } from "@/data/crucible/workspace.server"

describe("workspace source selection", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses fixtures by default during development", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const source = await readWorkspace()

    expect(source.status).toBe("ready")
    if (source.status === "ready") expect(source.mode).toBe("fixture")
  })

  it("rejects API-key mode in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "test-token")

    const source = await readWorkspace()

    expect(source).toEqual({
      status: "unavailable",
      reason: "Development API-key access is disabled in production.",
    })
  })

  it("rejects API-key delivery over a remote HTTP origin", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "http://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "test-token")

    const source = await readWorkspace()

    expect(source).toEqual({
      status: "unavailable",
      reason:
        "CRUCIBLE_API_BASE_URL must use HTTPS or point to the local machine.",
    })
  })
})
