import type { AsyncLocalStorage } from "node:async_hooks"

import { H3Event } from "h3-v2"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  clearLegacyPrivilegeModeCookie,
  writeGlobalPrivilegeMode,
} from "./privilege-mode.server"

const storageKey = Symbol.for("tanstack-start:event-storage")
const eventStorage = (
  globalThis as typeof globalThis &
    Record<
      typeof storageKey,
      AsyncLocalStorage<{ h3Event: H3Event }> | undefined
    >
)[storageKey]!

function runWithRequest(request: Request, fn: () => Promise<void>) {
  const h3Event = new H3Event(request)
  return eventStorage.run({ h3Event }, fn).then(() => {
    const cookies = h3Event.res.headers.getSetCookie()
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
