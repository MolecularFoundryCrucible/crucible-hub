import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  readWorkspaceServiceAccount,
  readWorkspaceServiceAccounts,
} from "./service-accounts.server"

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

describe("workspace service account source", () => {
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

    await expect(
      readWorkspaceServiceAccounts({ limit: 10 })
    ).rejects.toMatchObject({
      status: 403,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("paginates, filters, and sorts fixture service accounts", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const page = await readWorkspaceServiceAccounts({
      direction: "asc",
      limit: 20,
      sort: "username",
    })
    const neverActive = await readWorkspaceServiceAccounts({
      activity: "never",
      limit: 20,
    })

    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((account) => account.is_service_account)).toBe(true)
    expect(page.items[0]?.last_active_at).toBeTruthy()
    const usernames = page.items.map((account) => account.username)
    expect([...usernames].sort((a, b) => a.localeCompare(b))).toEqual(usernames)
    expect(neverActive.items).toHaveLength(0)
  })

  it("resolves fixture service account detail with activity and key usage timestamps", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "fixture")

    const list = await readWorkspaceServiceAccounts({ limit: 5 })
    const first = list.items[0]
    expect(first).toBeDefined()

    const detail = await readWorkspaceServiceAccount(first.unique_id)
    expect(detail).toMatchObject({
      api_key_status: {
        last_used_at: "2026-10-13T09:20:00Z",
        valid: true,
      },
      is_service_account: true,
      last_active_at: "2026-09-28T10:00:00Z",
      unique_id: first.unique_id,
    })
    await expect(
      readWorkspaceServiceAccount("missing-service-account")
    ).resolves.toBeNull()
  })

  it("queries GET /users with is_service_account, cursor, sort, and activity filters", async () => {
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
                api_key_status: {
                  created_at: "2026-09-01T12:00:00Z",
                  expires_at: "2027-09-01T12:00:00Z",
                  last_used_at: null,
                  valid: true,
                },
                email: null,
                first_name: "Beamline",
                is_service_account: true,
                last_active_at: "2026-10-14T15:00:00Z",
                last_name: "Ingestor",
                platform_role: "contributor",
                unique_id: "sa-1",
                username: "beamline_ingestor",
              },
            ],
            limit: 25,
            next_cursor: "next-sa-cursor",
            total: 1,
          },
          {},
          "elevated"
        )
      })
    )

    const result = await readWorkspaceServiceAccounts({
      activity: "never",
      cursor: "initial-cursor",
      direction: "desc",
      includeTotal: true,
      limit: 25,
      query: "beamline",
      sort: "last_active",
    })

    expect(result).toEqual({
      items: [
        {
          api_key_status: {
            created_at: "2026-09-01T12:00:00Z",
            expires_at: "2027-09-01T12:00:00Z",
            last_used_at: null,
            valid: true,
          },
          email: null,
          first_name: "Beamline",
          is_service_account: true,
          last_active_at: "2026-10-14T15:00:00Z",
          last_name: "Ingestor",
          platform_role: "contributor",
          unique_id: "sa-1",
          username: "beamline_ingestor",
        },
      ],
      limit: 25,
      nextCursor: "next-sa-cursor",
      total: 1,
    })
    const url = new URL(requests[0].url)
    expect(url.pathname).toBe("/users")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      cursor: "initial-cursor",
      direction: "desc",
      include_total: "true",
      is_service_account: "true",
      limit: "25",
      never_active: "true",
      q: "beamline",
      sort: "last_active",
    })
  })

  it("reads service account detail via GET /users/{user_ref} and rejects human accounts", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        const url = new URL(request.url)
        if (url.pathname === "/users/sa-1") {
          return crucibleApiResponse(
            {
              api_key_status: {
                created_at: "2026-09-01T12:00:00Z",
                expires_at: "2027-09-01T12:00:00Z",
                last_used_at: "2026-10-14T14:55:00Z",
                valid: true,
              },
              email: null,
              first_name: "Beamline",
              is_service_account: true,
              last_active_at: "2026-10-14T15:00:00Z",
              last_name: "Ingestor",
              platform_role: "contributor",
              unique_id: "sa-1",
              username: "beamline_ingestor",
            },
            {},
            "elevated"
          )
        }
        return crucibleApiResponse(
          {
            email: "human@example.invalid",
            first_name: "Human",
            is_service_account: false,
            last_name: "User",
            platform_role: "none",
            unique_id: "user-1",
            username: "human",
          },
          {},
          "elevated"
        )
      })
    )

    await expect(readWorkspaceServiceAccount("sa-1")).resolves.toEqual({
      api_key_status: {
        created_at: "2026-09-01T12:00:00Z",
        expires_at: "2027-09-01T12:00:00Z",
        last_used_at: "2026-10-14T14:55:00Z",
        valid: true,
      },
      email: null,
      first_name: "Beamline",
      is_service_account: true,
      last_active_at: "2026-10-14T15:00:00Z",
      last_name: "Ingestor",
      platform_role: "contributor",
      unique_id: "sa-1",
      username: "beamline_ingestor",
    })
    await expect(readWorkspaceServiceAccount("user-1")).resolves.toBeNull()
  })
})
