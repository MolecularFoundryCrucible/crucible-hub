import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import { patchWorkspaceAccount, readWorkspaceAccount } from "./account.server"

describe("workspace account source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("returns the fixture account outside production", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const account = await readWorkspaceAccount()

    expect(account.unique_id).toBe("0000-0000-0000-000X")
    expect(account.email).toBe("avery.chen@example.invalid")
  })

  it("returns a confirmed fixture profile update", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      patchWorkspaceAccount({
        email: "avery@example.invalid",
        first_name: "Avery",
        username: "avery_chen",
      })
    ).resolves.toMatchObject({
      email: "avery@example.invalid",
      first_name: "Avery",
      last_name: "Chen",
      username: "avery_chen",
    })
  })

  it("patches only selected profile fields through the API", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const fetchMock = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe("/account/profile")
      expect(request.method).toBe("PATCH")
      await expect(request.json()).resolves.toEqual({
        first_name: "Ada",
        username: "ada_lovelace",
      })
      return crucibleApiResponse({
        email: "ada@example.invalid",
        first_name: "Ada",
        is_service_account: false,
        last_name: "Lovelace",
        unique_id: "0000-0000-0000-0001",
        username: "ada_lovelace",
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      patchWorkspaceAccount({
        first_name: "Ada",
        username: "ada_lovelace",
      })
    ).resolves.toMatchObject({
      email: "ada@example.invalid",
      unique_id: "0000-0000-0000-0001",
      username: "ada_lovelace",
    })
    expect(fetchMock).toHaveBeenCalledOnce()
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
