import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  checkWorkspaceEmailExactMatch,
  createWorkspaceUser,
  patchWorkspaceUser,
  provisionWorkspaceUserApiKey,
  readWorkspaceUserApiKeyStatus,
  readWorkspaceUserDetail,
  readWorkspaceUsers,
} from "./users.server"

describe("workspace user source", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("resolves fixture user detail by unique_id", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const account = await readWorkspaceUserDetail("0000-0000-0000-000X")

    expect(account).toMatchObject({
      platform_role: "admin",
      unique_id: "0000-0000-0000-000X",
      username: "avery.chen",
    })
    await expect(readWorkspaceUserDetail("missing-user")).resolves.toBeNull()
  })

  it("paginates and filters fixture users", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const page = await readWorkspaceUsers({ limit: 2, offset: 0 })
    const serviceAccounts = await readWorkspaceUsers({
      is_service_account: true,
      limit: 20,
      offset: 0,
    })
    const queried = await readWorkspaceUsers({
      limit: 20,
      offset: 0,
      query: "avery",
    })

    expect(page.items).toHaveLength(2)
    expect(page.total).toBeGreaterThan(2)
    expect(serviceAccounts.items.every((user) => user.is_service_account)).toBe(
      true
    )
    expect(queried.items).toHaveLength(1)
    expect(queried.items[0]).toMatchObject({ username: "avery.chen" })
  })

  it("checks email availability in fixture and API mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      checkWorkspaceEmailExactMatch("avery.chen@example.invalid")
    ).resolves.toBe(true)
    await expect(
      checkWorkspaceEmailExactMatch("AVERY.CHEN@EXAMPLE.INVALID")
    ).resolves.toBe(true)
    await expect(
      checkWorkspaceEmailExactMatch("other@example.invalid")
    ).resolves.toBe(false)

    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url)
      expect(url.pathname).toBe("/users")
      expect(url.searchParams.get("limit")).toBe("1")
      expect(request.headers.get("Crucible-Privilege-Mode")).toBe("elevated")
      const email = url.searchParams.get("email")
      if (email === "taken@example.invalid") {
        return crucibleApiResponse(
          {
            items: [
              {
                email: "taken@example.invalid",
                first_name: "Ada",
                is_service_account: false,
                last_name: "Lovelace",
                unique_id: "user-1",
                username: "ada",
              },
            ],
          },
          {},
          "elevated"
        )
      }
      return crucibleApiResponse({ items: [] }, {}, "elevated")
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      checkWorkspaceEmailExactMatch("taken@example.invalid")
    ).resolves.toBe(true)
    await expect(
      checkWorkspaceEmailExactMatch("open@example.invalid")
    ).resolves.toBe(false)
  })

  it("requires the API to confirm elevated privilege mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => crucibleApiResponse({ items: [] }, {}, "normal"))
    )

    await expect(
      checkWorkspaceEmailExactMatch("open@example.invalid")
    ).rejects.toThrow(
      "The Crucible API did not apply the requested privilege mode."
    )
  })

  it("reads and provisions API key status without exposing fixture secrets", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      readWorkspaceUserApiKeyStatus("0000-0000-0000-000X")
    ).resolves.toMatchObject({ valid: true })
    await expect(
      provisionWorkspaceUserApiKey("0000-0000-0000-000X")
    ).resolves.toEqual({ api_key: "crucible_mock_key_0-000X" })

    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url)
      expect(request.headers.get("Crucible-Privilege-Mode")).toBe("elevated")
      if (request.method === "GET") {
        expect(url.pathname).toBe("/users/user-1/apikey/verify")
        return crucibleApiResponse(
          {
            created_at: "2026-01-01T00:00:00Z",
            expires_at: "2027-01-01T00:00:00Z",
            valid: true,
          },
          {},
          "elevated"
        )
      }
      expect(request.method).toBe("POST")
      expect(url.pathname).toBe("/users/user-1/apikey")
      return crucibleApiResponse(
        { api_key: "crucible_live_key" },
        {},
        "elevated"
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      readWorkspaceUserApiKeyStatus("user-1")
    ).resolves.toMatchObject({ valid: true })
    await expect(provisionWorkspaceUserApiKey("user-1")).resolves.toEqual({
      api_key: "crucible_live_key",
    })
  })

  it("creates users through the API with the elevated privilege header", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    const fetchMock = vi.fn(async (request: Request) => {
      expect(request.method).toBe("POST")
      expect(new URL(request.url).pathname).toBe("/users")
      expect(await request.json()).toEqual({
        project_ids: ["project-1"],
        user_info: {
          email: "ada@example.invalid",
          first_name: "Ada",
          last_name: "Lovelace",
          unique_id: null,
          username: "ada",
        },
      })
      return crucibleApiResponse(
        {
          email: "ada@example.invalid",
          first_name: "Ada",
          is_service_account: false,
          last_name: "Lovelace",
          unique_id: "user-1",
          username: "ada",
        },
        {},
        "elevated"
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createWorkspaceUser({
        email: "ada@example.invalid",
        first_name: "Ada",
        last_name: "Lovelace",
        project_ids: ["project-1"],
        username: "ada",
      })
    ).resolves.toMatchObject({ unique_id: "user-1", username: "ada" })
  })

  it("patches user profiles through the API", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    const fetchMock = vi.fn(async (request: Request) => {
      expect(request.method).toBe("PATCH")
      expect(new URL(request.url).pathname).toBe("/users/user-1")
      expect(await request.json()).toEqual({ first_name: "Grace" })
      return crucibleApiResponse(
        {
          email: "ada@example.invalid",
          first_name: "Grace",
          is_service_account: false,
          last_name: "Lovelace",
          platform_role: "admin",
          unique_id: "user-1",
          username: "ada",
        },
        {},
        "elevated"
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      patchWorkspaceUser("user-1", { first_name: "Grace" })
    ).resolves.toMatchObject({ first_name: "Grace", platform_role: "admin" })
  })

  it("does not bypass the production fixture guard", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "")

    await expect(readWorkspaceUsers({ limit: 20, offset: 0 })).rejects.toThrow(
      "The Crucible API login exchange is not connected yet."
    )
  })
})
