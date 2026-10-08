import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  checkWorkspaceEmailExactMatch,
  createWorkspaceUser,
  patchWorkspaceUser,
  provisionWorkspaceUserApiKey,
  readWorkspaceUserDetail,
  readWorkspaceUsers,
  revokeWorkspaceUserApiKey,
  updateWorkspaceUserPlatformRole,
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

    const page = await readWorkspaceUsers({ limit: 2 })
    const serviceAccounts = await readWorkspaceUsers({
      is_service_account: true,
      limit: 20,
    })
    const queried = await readWorkspaceUsers({ limit: 20, query: "avery" })
    const sorted = await readWorkspaceUsers({ limit: 20, sort: "name" })

    expect(page.items).toHaveLength(2)
    expect(page.total).toBeGreaterThan(2)
    expect(page.nextCursor).toBeTruthy()
    const nextPage = await readWorkspaceUsers({
      cursor: page.nextCursor ?? "",
      limit: 2,
    })
    expect(
      nextPage.items.every(
        (user) => !page.items.some((seen) => seen.unique_id === user.unique_id)
      )
    ).toBe(true)
    expect(serviceAccounts.items.every((user) => user.is_service_account)).toBe(
      true
    )
    expect(queried.items).toHaveLength(1)
    expect(queried.items[0]).toMatchObject({ username: "avery.chen" })
    const names = sorted.items.map((user) =>
      `${user.first_name} ${user.last_name}`.trim()
    )
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names)
  })

  it("searches and paginates users through GET /users query parameters", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request)
        return crucibleApiResponse(
          {
            items: [
              {
                email: "ada@example.invalid",
                first_name: "Ada",
                is_service_account: false,
                last_name: "Lovelace",
                platform_role: "none",
                unique_id: "user-1",
                user_capabilities: {
                  can_change_platform_role: true,
                  can_edit_profile: true,
                  can_manage_api_key: true,
                  can_view_private: true,
                },
                username: "ada",
              },
            ],
            limit: 50,
            next_cursor: "cursor-token",
            total: 1,
          },
          {},
          "elevated"
        )
      })
    )

    const queried = await readWorkspaceUsers({
      includeTotal: true,
      limit: 50,
      query: "ada",
      sort: "name",
    })

    expect(queried).toMatchObject({
      limit: 50,
      nextCursor: "cursor-token",
      total: 1,
    })
    expect(queried.items[0]).toMatchObject({
      platform_role: "none",
      unique_id: "user-1",
      user_capabilities: { can_change_platform_role: true },
    })
    expect(Object.fromEntries(new URL(requests[0].url).searchParams)).toEqual({
      include_total: "true",
      limit: "50",
      q: "ada",
      sort: "name",
    })
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

  it("carries API key status on user records and provisions keys without exposing secrets", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    const account = await readWorkspaceUserDetail("0000-0000-0000-000X")
    expect(account).toMatchObject({
      api_key_status: { valid: true },
      user_capabilities: { can_change_platform_role: true },
    })
    await expect(
      provisionWorkspaceUserApiKey("0000-0000-0000-000X")
    ).resolves.toEqual({ api_key: "crucible_mock_key_0-000X" })

    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    const fetchMock = vi.fn(async (request: Request) => {
      expect(request.method).toBe("POST")
      expect(new URL(request.url).pathname).toBe("/users/user-1/apikey")
      expect(request.headers.get("Crucible-Privilege-Mode")).toBe("elevated")
      return crucibleApiResponse(
        { api_key: "crucible_live_key" },
        {},
        "elevated"
      )
    })
    vi.stubGlobal("fetch", fetchMock)

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
          api_key_status: {
            created_at: "2026-01-01T00:00:00Z",
            expires_at: "2027-01-01T00:00:00Z",
            valid: true,
          },
          email: "ada@example.invalid",
          first_name: "Grace",
          is_service_account: false,
          last_name: "Lovelace",
          platform_role: "admin",
          unique_id: "user-1",
          user_capabilities: {
            can_change_platform_role: true,
            can_edit_profile: true,
            can_manage_api_key: true,
            can_view_private: true,
          },
          username: "ada",
        },
        {},
        "elevated"
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      patchWorkspaceUser("user-1", { first_name: "Grace" })
    ).resolves.toMatchObject({
      api_key_status: { valid: true },
      first_name: "Grace",
      platform_role: "admin",
      user_capabilities: { can_edit_profile: true },
    })
  })

  it("changes user platform roles through the dedicated endpoint", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      updateWorkspaceUserPlatformRole("0000-0000-0000-0018", "contributor")
    ).resolves.toMatchObject({
      platform_role: "contributor",
      unique_id: "0000-0000-0000-0018",
    })

    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    const fetchMock = vi.fn(async (request: Request) => {
      expect(request.method).toBe("PATCH")
      expect(new URL(request.url).pathname).toBe("/users/user-1/platform_role")
      expect(request.headers.get("Crucible-Privilege-Mode")).toBe("elevated")
      expect(await request.json()).toEqual({ platform_role: "admin" })
      return crucibleApiResponse(
        {
          api_key_status: {
            created_at: "2026-01-01T00:00:00Z",
            expires_at: "2027-01-01T00:00:00Z",
            valid: true,
          },
          email: "ada@example.invalid",
          first_name: "Ada",
          is_service_account: false,
          last_name: "Lovelace",
          platform_role: "admin",
          unique_id: "user-1",
          user_capabilities: {
            can_change_platform_role: true,
            can_edit_profile: true,
            can_manage_api_key: true,
            can_view_private: true,
          },
          username: "ada",
        },
        {},
        "elevated"
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      updateWorkspaceUserPlatformRole("user-1", "admin")
    ).resolves.toMatchObject({
      api_key_status: { valid: true },
      platform_role: "admin",
      user_capabilities: { can_change_platform_role: true },
    })
  })

  it("revokes user API keys without returning secrets", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "")

    await expect(
      revokeWorkspaceUserApiKey("0000-0000-0000-0018")
    ).resolves.toBe(undefined)

    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")

    const fetchMock = vi.fn(async (request: Request) => {
      expect(request.method).toBe("DELETE")
      expect(new URL(request.url).pathname).toBe("/users/user-1/apikey")
      expect(request.headers.get("Crucible-Privilege-Mode")).toBe("elevated")
      return new Response(null, {
        headers: {
          "Cache-Control": "no-store",
          "Crucible-Privilege-Mode": "elevated",
        },
        status: 204,
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(revokeWorkspaceUserApiKey("user-1")).resolves.toBe(undefined)
  })

  it("does not bypass the production fixture guard", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_DATA_SOURCE", "")
    vi.stubEnv("HUB_ENABLE_FIXTURES", "")

    await expect(readWorkspaceUsers({ limit: 20 })).rejects.toThrow(
      "The Crucible API login exchange is not connected yet."
    )
  })
})
