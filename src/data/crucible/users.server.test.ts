import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  checkWorkspaceEmailExactMatch,
  createWorkspaceUser,
  patchWorkspaceUser,
  readWorkspaceUsers,
  updateWorkspaceUserPlatformRole,
} from "./users.server"

const administratorView = vi.hoisted(() => ({ on: true }))

vi.mock("@/server/crucible/privilege-mode.server", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  const { CrucibleResponseError } =
    await import("@/server/crucible/request-error.server")
  return {
    ...original,
    requireAdministratorView: () => {
      if (!administratorView.on) throw new CrucibleResponseError(403)
      return "elevated" as const
    },
  }
})

describe("workspace user source", () => {
  afterEach(() => {
    administratorView.on = true
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("refuses API administration while the administrator view is off", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    administratorView.on = false
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(readWorkspaceUsers({ limit: 2 })).rejects.toMatchObject({
      status: 403,
    })
    expect(fetchMock).not.toHaveBeenCalled()
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
    expect(Object.fromEntries(new URL(requests[0]!.url).searchParams)).toEqual({
      include_total: "true",
      limit: "50",
      q: "ada",
      sort: "name",
    })
  })

  it("checks email availability through the API", async () => {
    vi.stubEnv("NODE_ENV", "development")
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
})
