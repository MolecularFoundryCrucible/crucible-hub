import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  regenerateWorkspaceAccountApiKey,
  checkWorkspaceUsernameExactMatch,
  patchWorkspaceAccount,
  readWorkspaceAccount,
} from "./account.server"

describe("workspace account source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("returns the fixture account outside production", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const account = await readWorkspaceAccount()

    expect(account.unique_id).toBe("0000-0000-0000-000X")
    expect(account.email).toBe("avery.chen@example.invalid")
    expect(account.last_active_at).toBe("2026-09-01T16:00:00Z")
  })

  it("matches the account username when checking username availability", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    await expect(checkWorkspaceUsernameExactMatch("avery.chen")).resolves.toBe(
      true
    )
    await expect(checkWorkspaceUsernameExactMatch("AVERY.CHEN")).resolves.toBe(
      true
    )
    await expect(checkWorkspaceUsernameExactMatch("morgan.lee")).resolves.toBe(
      true
    )
    await expect(
      checkWorkspaceUsernameExactMatch("available.username")
    ).resolves.toBe(false)
  })

  it("returns a confirmed fixture profile update", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

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
      if (request.method === "PATCH") {
        await expect(request.json()).resolves.toEqual({
          first_name: "Ada",
          username: "ada_lovelace",
        })
      } else {
        expect(request.method).toBe("GET")
      }
      return crucibleApiResponse({
        authorization: {
          assigned_platform_role: "none",
          effective_platform_role: "none",
          privilege_mode: "normal",
        },
        capabilities: {
          can_create_project: true,
          can_create_resource: true,
          can_manage_service_accounts: false,
          can_register_instrument: true,
        },
        email: "ada@example.invalid",
        first_name: "Ada",
        is_service_account: false,
        last_active_at: "2026-04-06T20:00:00Z",
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
      last_active_at: "2026-04-06T20:00:00Z",
      unique_id: "0000-0000-0000-0001",
      username: "ada_lovelace",
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not bypass the production fixture guard", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "")

    await expect(readWorkspaceAccount()).rejects.toThrow(
      "The Crucible API login exchange is not connected yet."
    )
  })
})

describe("account API key regeneration", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("issues a one-time key in fixture mode", async () => {
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")
    const result = await regenerateWorkspaceAccountApiKey()
    expect(result.api_key).toMatch(/^fixture-key-/)
  })

  it("refuses when the Hub itself signs in with the API key", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(regenerateWorkspaceAccountApiKey()).rejects.toMatchObject({
      status: 403,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
