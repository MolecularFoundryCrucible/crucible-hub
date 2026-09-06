import { afterEach, describe, expect, it, vi } from "vitest"

import { readWorkspaceAccount } from "./account.server"

describe("workspace account source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns the fixture account outside production", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const account = await readWorkspaceAccount()

    expect(account.unique_id).toBe("0000-0000-0000-000X")
  })

  it("does not bypass the production fixture guard", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "")

    await expect(readWorkspaceAccount()).rejects.toThrow(
      "The Crucible API login exchange is not connected yet."
    )
  })
})
