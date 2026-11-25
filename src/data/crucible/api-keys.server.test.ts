import { afterEach, describe, expect, it, vi } from "vitest"

import { crucibleApiResponse } from "@/test/crucible-api-response"

import { createWorkspaceApiKey } from "./api-keys.server"

vi.mock("@/server/crucible/privilege-mode.server", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requireAdministratorView: () => "elevated" as const,
}))

describe("API key creation", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("creates a key that never expires for another account as an administrator", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "api")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
    vi.stubEnv("CRUCIBLE_API_KEY", "local-test-key")
    const requests: Request[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request.clone())
        return crucibleApiResponse(
          {
            api_key: "crucible_new",
            created_at: "2026-11-25T00:00:00Z",
            expires_at: null,
            id: 7,
            last4: "1234",
            name: "Deploy",
            status: "active",
          },
          { status: 201 },
          "elevated"
        )
      })
    )

    await createWorkspaceApiKey(
      { kind: "user", userId: "service-account-1" },
      { expiresAt: null, name: "Deploy", neverExpires: true }
    )

    const [request] = requests
    expect(new URL(request!.url).pathname).toBe(
      "/users/service-account-1/apikeys"
    )
    expect(request!.headers.get("Crucible-Privilege-Mode")).toBe("elevated")
    await expect(request!.json()).resolves.toEqual({
      name: "Deploy",
      never_expires: true,
    })
  })
})
