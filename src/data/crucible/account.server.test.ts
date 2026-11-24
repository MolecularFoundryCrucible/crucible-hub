import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import { patchWorkspaceAccount } from "./account.server"

describe("workspace account source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
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
})
