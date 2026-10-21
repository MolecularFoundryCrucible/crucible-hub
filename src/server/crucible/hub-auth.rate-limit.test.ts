import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  enforceHubLoginRateLimit,
  HubLoginRateLimitError,
} from "./hub-auth.server"
import { startRequestScope } from "@/test/start-request"

function attempt(ip: string): Promise<void> {
  const scope = startRequestScope("https://hub.example.test/hub/auth/login", {
    headers: { "x-forwarded-for": ip },
  })
  return scope.run(async () => {
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
