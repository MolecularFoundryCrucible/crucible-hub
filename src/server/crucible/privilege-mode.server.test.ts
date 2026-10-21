import { afterEach, describe, expect, it, vi } from "vitest"

import {
  clearLegacyPrivilegeModeCookie,
  writeGlobalPrivilegeMode,
} from "./privilege-mode.server"
import { startRequestScope } from "@/test/start-request"

function runWithRequest(request: Request, fn: () => Promise<void>) {
  const scope = startRequestScope(request.url, { headers: request.headers })
  return scope.run(fn).then(() => {
    const cookies = scope.setCookies()
    return cookies.filter((cookie) =>
      cookie.startsWith("crucible_hub_administrator_view=")
    )
  })
}

describe("privilege-mode server", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("derives the legacy cookie Secure flag from the configured Hub origin", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "hub-auth")
    vi.stubEnv(
      "HUB_AUTH_CALLBACK_URI",
      "https://hub.example.test/hub/auth/callback"
    )

    const secureCookies = await runWithRequest(
      new Request("https://hub.example.test/hub/data"),
      async () => {
        await writeGlobalPrivilegeMode("elevated")
      }
    )
    const insecureRequestCookies = await runWithRequest(
      new Request("http://upstream.internal/hub/data"),
      async () => {
        await writeGlobalPrivilegeMode("elevated")
      }
    )

    expect(secureCookies).toHaveLength(1)
    expect(insecureRequestCookies).toEqual(secureCookies)
    expect(secureCookies[0]).toContain("Secure")
    expect(secureCookies[0]).toContain("HttpOnly")
    expect(secureCookies[0]).toContain("SameSite=Lax")
  })

  it("clears the legacy cookie when returning to normal mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("HUB_DATA_SOURCE", "hub-auth")
    vi.stubEnv(
      "HUB_AUTH_CALLBACK_URI",
      "https://hub.example.test/hub/auth/callback"
    )

    const cookies = await runWithRequest(
      new Request("https://hub.example.test/hub/data"),
      async () => {
        clearLegacyPrivilegeModeCookie()
      }
    )

    expect(cookies).toHaveLength(1)
    expect(cookies[0]).toContain("crucible_hub_administrator_view=;")
    expect(cookies[0]).toContain("Max-Age=0")
  })
})
