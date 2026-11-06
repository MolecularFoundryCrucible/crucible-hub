import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import {
  approveWorkspaceUser,
  readWorkspacePendingUsers,
  rejectWorkspaceUser,
} from "./user-approvals.server"

vi.mock("@/server/crucible/privilege-mode.server", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requireAdministratorView: () => "elevated" as const,
}))

const waiting = {
  email: "jo.rivera@example.invalid",
  first_name: "Jo",
  is_service_account: false,
  last_name: "Rivera",
  pending_at: "2026-11-05T10:00:00Z",
  unique_id: "01JBQ0000000000000000000JR",
  username: "jo.rivera",
}

describe("account approvals", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("lists waiting accounts oldest first with a total", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url)
      expect(url.pathname).toBe("/users")
      expect(url.searchParams.get("pending")).toBe("true")
      expect(url.searchParams.get("include_total")).toBe("true")
      expect(url.searchParams.get("direction")).toBe("asc")
      expect(request.headers.get("Crucible-Privilege-Mode")).toBe("elevated")
      return crucibleApiResponse(
        { items: [waiting], limit: 50, total: 1 },
        {},
        "elevated"
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(readWorkspacePendingUsers()).resolves.toMatchObject({
      items: [{ pending_at: "2026-11-05T10:00:00Z", username: "jo.rivera" }],
      total: 1,
    })
  })

  it("approves an account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        expect(request.method).toBe("POST")
        expect(new URL(request.url).pathname).toBe(
          `/users/${waiting.unique_id}/approve`
        )
        return crucibleApiResponse(
          { ...waiting, pending_at: null },
          {},
          "elevated"
        )
      })
    )
    await expect(
      approveWorkspaceUser(waiting.unique_id)
    ).resolves.toMatchObject({ pending_at: null })
  })

  it("reports why a rejection was refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        crucibleApiResponse(
          { detail: { code: "still_referenced", message: "Referenced." } },
          { status: 409 },
          "elevated"
        )
      )
    )
    await expect(rejectWorkspaceUser(waiting.unique_id)).rejects.toMatchObject({
      conflictCode: "still_referenced",
      status: 409,
    })
  })
})
