import { AsyncLocalStorage } from "node:async_hooks"

import { H3Event } from "h3-v2"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  enforceHubLoginRateLimit,
  HubLoginRateLimitError,
} from "./hub-auth.server"

const storageKey = Symbol.for("tanstack-start:event-storage")
const eventStorage = (
  globalThis as typeof globalThis &
    Record<
      typeof storageKey,
      AsyncLocalStorage<{ h3Event: H3Event }> | undefined
    >
)[storageKey]!

function attempt(ip: string): Promise<void> {
  const h3Event = new H3Event(
    new Request("https://hub.example.test/hub/auth/login", {
      headers: { "x-forwarded-for": ip },
    })
  )
  return eventStorage!.run({ h3Event }, async () => {
    enforceHubLoginRateLimit()
  })
}

describe("hub login rate limit", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("allows sign-ins under the limit and blocks beyond it per client", async () => {
    for (let index = 0; index < 30; index += 1) {
      await expect(attempt("10.0.0.1")).resolves.toBeUndefined()
    }
    await expect(attempt("10.0.0.1")).rejects.toBeInstanceOf(
      HubLoginRateLimitError
    )
    await expect(attempt("10.0.0.2")).resolves.toBeUndefined()
  })

  it("unblocks a client after the window expires", async () => {
    for (let index = 0; index < 30; index += 1) {
      await attempt("10.0.0.3")
    }
    await expect(attempt("10.0.0.3")).rejects.toBeInstanceOf(
      HubLoginRateLimitError
    )
    vi.setSystemTime(new Date("2026-10-06T12:10:00Z"))
    await expect(attempt("10.0.0.3")).resolves.toBeUndefined()
  })
})
