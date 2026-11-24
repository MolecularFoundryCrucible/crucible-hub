import { afterEach, describe, expect, it, vi } from "vitest"

import { readWorkspaceFixture } from "@/data/crucible/workspace-fixture.server"

describe("workspace fixture adapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("fails closed in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "")

    const source = readWorkspaceFixture()

    expect(source.status).toBe("unavailable")
  })

  it("allows an explicit production preview", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "true")

    const source = readWorkspaceFixture()

    expect(source.status).toBe("ready")
  })

  it("rejects non-default scenarios in production previews", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "true")

    expect(readWorkspaceFixture("empty").status).toBe("unavailable")
  })
})
