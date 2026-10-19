import type { AsyncLocalStorage } from "node:async_hooks"

import { H3Event } from "h3-v2"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  beginHubLogin,
  finishHubLogin,
  hasHubSession,
  hubAuthPublicOrigin,
  sessionApiFetch,
} from "./hub-auth.server"

const storageKey = Symbol.for("tanstack-start:event-storage")
const eventStorage = (
  globalThis as typeof globalThis &
    Record<
      typeof storageKey,
      AsyncLocalStorage<{ h3Event: H3Event }> | undefined
    >
)[storageKey]!

const tokenResponse = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  access_expires_at: "2026-10-06T23:00:00.000Z",
  refresh_expires_at: "2026-11-06T00:00:00.000Z",
  token_type: "Bearer",
  user_unique_id: "0000-0000-0000-000X",
}

function stubHubAuthEnv() {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("HUB_DATA_SOURCE", "hub-auth")
  vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
  vi.stubEnv("HUB_AUTH_CLIENT_SECRET", "test-secret")
}

async function beginLogin(returnTo: string | null) {
  const h3Event = new H3Event(
    new Request(
      `http://127.0.0.1:3000/hub/auth/login${
        returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""
      }`
    )
  )
  let location: string | undefined
  await eventStorage.run({ h3Event }, async () => {
    location = await beginHubLogin(returnTo)
  })
  return { h3Event, location: location! }
}

function loginCookie(h3Event: H3Event): string {
  const cookie = h3Event.res.headers
    .getSetCookie()
    .find((value) => value.startsWith("crucible_hub_login="))
  expect(cookie).toBeDefined()
  return cookie!
}

async function finishLogin(
  transactionCookie: string,
  code: string,
  state: string
) {
  const h3Event = new H3Event(
    new Request("http://127.0.0.1:3000/hub/auth/callback", {
      headers: { cookie: transactionCookie.split(";")[0] },
    })
  )
  const destination = await eventStorage.run({ h3Event }, () =>
    finishHubLogin(code, state)
  )
  return { destination, cookies: h3Event.res.headers.getSetCookie() }
}

describe("hub login exchange", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("begins a login with PKCE parameters and completes it into a session", async () => {
    stubHubAuthEnv()
    const { h3Event, location } = await beginLogin("/hub/data")
    const providerUrl = new URL(location)

    expect(providerUrl.origin).toBe("https://api.example.test")
    expect(providerUrl.pathname).toBe("/auth/hub/login")
    expect(providerUrl.searchParams.get("client_id")).toBe("crucible-hub")
    expect(providerUrl.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:3000/hub/auth/callback"
    )
    expect(providerUrl.searchParams.get("code_challenge_method")).toBe("S256")
    expect(providerUrl.searchParams.get("code_challenge")).toMatch(
      /^[A-Za-z0-9_-]{43}$/
    )
    expect(providerUrl.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const transactionCookie = loginCookie(h3Event)
    expect(transactionCookie).toContain("HttpOnly")
    expect(transactionCookie).toContain("SameSite=Lax")
    expect(transactionCookie).toContain("Max-Age=600")
    expect(transactionCookie).toContain("Path=/hub/auth")

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        )
        expect(url.pathname).toBe("/auth/hub/token")
        expect(init?.method).toBe("POST")
        const headers = init?.headers as Record<string, string>
        expect(headers.Authorization).toMatch(/^Basic /)
        const body = JSON.parse(String(init?.body)) as {
          code: string
          code_verifier: string
          redirect_uri: string
        }
        expect(body.code).toBe("one-time-code")
        expect(body.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(body.redirect_uri).toBe(
          "http://127.0.0.1:3000/hub/auth/callback"
        )
        return Response.json(tokenResponse)
      }
    )
    vi.stubGlobal("fetch", fetchMock)

    const state = providerUrl.searchParams.get("state")!
    const { destination, cookies } = await finishLogin(
      transactionCookie,
      "one-time-code",
      state
    )
    expect(destination).toBe("/hub/data")

    const sessionCookie = cookies.find((value) =>
      value.startsWith("crucible_hub_session=")
    )
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie).toContain("HttpOnly")
    expect(sessionCookie).toContain("SameSite=Lax")
    expect(sessionCookie).toContain("Path=/hub")
    expect(sessionCookie).toContain("Max-Age=2592000")

    const revokedLoginCookie = cookies.find((value) =>
      value.startsWith("crucible_hub_login=")
    )
    expect(revokedLoginCookie).toContain("Max-Age=0")
  })

  it("falls back to the Hub home when returnTo leaves the Hub origin", async () => {
    stubHubAuthEnv()
    const { h3Event, location } = await beginLogin(
      "https://evil.example/hub/data"
    )
    const transactionCookie = loginCookie(h3Event)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(tokenResponse))
    )
    const state = new URL(location).searchParams.get("state")!
    const { destination } = await finishLogin(transactionCookie, "code", state)
    expect(destination).toBe("/hub/")
  })

  it("rejects a callback whose state does not match the transaction", async () => {
    stubHubAuthEnv()
    const { h3Event } = await beginLogin("/hub/data")
    const transactionCookie = loginCookie(h3Event)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(tokenResponse))
    )
    await expect(
      finishLogin(transactionCookie, "code", "wrong-state-wrong-state-wrong-1")
    ).rejects.toThrow("The sign-in request could not be verified.")
  })

  it("consumes a sign-in transaction once", async () => {
    stubHubAuthEnv()
    const { h3Event, location } = await beginLogin("/hub/data")
    const transactionCookie = loginCookie(h3Event)
    const state = new URL(location).searchParams.get("state")!
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(tokenResponse))
    )
    await finishLogin(transactionCookie, "code", state)
    await expect(finishLogin(transactionCookie, "code", state)).rejects.toThrow(
      "The sign-in request has expired."
    )
  })

  it("rejects the callback when the token exchange is rejected", async () => {
    stubHubAuthEnv()
    const { h3Event, location } = await beginLogin("/hub/data")
    const transactionCookie = loginCookie(h3Event)
    const state = new URL(location).searchParams.get("state")!
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 401 }))
    )
    await expect(finishLogin(transactionCookie, "code", state)).rejects.toThrow(
      "The Crucible sign-in request failed."
    )
  })

  it("forwards max_age to force ORCID re-authentication", async () => {
    stubHubAuthEnv()
    const h3Event = new H3Event(
      new Request("http://127.0.0.1:3000/hub/auth/login")
    )
    const location = await eventStorage.run({ h3Event }, () =>
      beginHubLogin("/hub/account", 0)
    )
    expect(new URL(location).searchParams.get("max_age")).toBe("0")
  })

  it("keeps the session when the API requires a recent sign-in", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T12:00:00.000Z"))
    stubHubAuthEnv()
    const { h3Event, location } = await beginLogin("/hub/")
    const state = new URL(location).searchParams.get("state")!
    const requests: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        )
        requests.push(url.pathname)
        if (url.pathname === "/auth/hub/token") {
          return Response.json(tokenResponse)
        }
        return new Response(null, {
          headers: {
            "WWW-Authenticate":
              'Bearer error="insufficient_user_authentication", max_age="600"',
          },
          status: 401,
        })
      })
    )
    const { cookies } = await finishLogin(loginCookie(h3Event), "code", state)
    const sessionCookie = cookies
      .find((value) => value.startsWith("crucible_hub_session="))!
      .split(";")[0]

    const apiEvent = new H3Event(
      new Request("http://127.0.0.1:3000/hub/account", {
        headers: { cookie: sessionCookie },
      })
    )
    await eventStorage.run({ h3Event: apiEvent }, async () => {
      const response = await sessionApiFetch()(
        "https://api.example.test/service_accounts",
        { method: "POST" }
      )
      expect(response.status).toBe(401)
      expect(hasHubSession()).toBe(true)
    })
    expect(requests).toEqual(["/auth/hub/token", "/service_accounts"])
  })

  async function signedInSession(
    respond: (path: string) => Response | Promise<Response>
  ) {
    const { h3Event, location } = await beginLogin("/hub/")
    const state = new URL(location).searchParams.get("state")!
    const requests: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        )
        requests.push(url.pathname)
        if (url.pathname === "/auth/hub/token") {
          return Response.json(tokenResponse)
        }
        return respond(url.pathname)
      })
    )
    const { cookies } = await finishLogin(loginCookie(h3Event), "code", state)
    const sessionCookie = cookies
      .find((value) => value.startsWith("crucible_hub_session="))!
      .split(";")[0]
    const call = () => {
      const apiEvent = new H3Event(
        new Request("http://127.0.0.1:3000/hub/data", {
          headers: { cookie: sessionCookie },
        })
      )
      return eventStorage.run({ h3Event: apiEvent }, async () => {
        try {
          const response = await sessionApiFetch()(
            "https://api.example.test/datasets"
          )
          return { response, signedIn: hasHubSession() }
        } catch (error) {
          return { error, signedIn: hasHubSession() }
        }
      })
    }
    return { call, requests }
  }

  it("keeps the session and the current access token when a refresh is rate limited", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T22:59:45.000Z"))
    stubHubAuthEnv()
    const { call, requests } = await signedInSession((path) =>
      path === "/auth/hub/refresh"
        ? new Response(null, { headers: { "Retry-After": "20" }, status: 429 })
        : Response.json([])
    )

    const first = await call()
    expect(first.response?.status).toBe(200)
    expect(first.signedIn).toBe(true)
    const second = await call()
    expect(second.response?.status).toBe(200)
    expect(requests).toEqual([
      "/auth/hub/token",
      "/auth/hub/refresh",
      "/datasets",
      "/datasets",
    ])
  })

  it("waits out a rate-limited refresh after expiry and then recovers", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T23:00:30.000Z"))
    stubHubAuthEnv()
    let refreshes = 0
    const { call } = await signedInSession((path) => {
      if (path !== "/auth/hub/refresh") return Response.json([])
      refreshes += 1
      return refreshes === 1
        ? new Response(null, { headers: { "Retry-After": "10" }, status: 429 })
        : Response.json({
            ...tokenResponse,
            access_token: "access-2",
            access_expires_at: "2026-10-06T23:15:30.000Z",
            refresh_token: "refresh-2",
          })
    })

    const failed = await call()
    expect(failed.error).toMatchObject({ retryAfterSeconds: 10, status: 429 })
    expect(failed.signedIn).toBe(true)
    const waiting = await call()
    expect(waiting.error).toMatchObject({ status: 429 })
    expect(refreshes).toBe(1)

    vi.setSystemTime(new Date("2026-10-06T23:00:41.000Z"))
    const recovered = await call()
    expect(recovered.response?.status).toBe(200)
    expect(recovered.signedIn).toBe(true)
    expect(refreshes).toBe(2)
  })

  it("closes the session after an uncertain refresh instead of replaying the token", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T23:00:30.000Z"))
    stubHubAuthEnv()
    const { call } = await signedInSession((path) =>
      path === "/auth/hub/refresh"
        ? new Response(null, { status: 504 })
        : Response.json([])
    )

    const result = await call()
    expect(result.error).toBeInstanceOf(Error)
    expect(result.signedIn).toBe(false)
  })

  it("ends the session when the refresh token is rejected", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T23:00:30.000Z"))
    stubHubAuthEnv()
    const { call } = await signedInSession((path) =>
      path === "/auth/hub/refresh"
        ? Response.json({ detail: "invalid_grant" }, { status: 400 })
        : Response.json([])
    )

    const result = await call()
    expect(result.error).toBeInstanceOf(Error)
    expect(result.signedIn).toBe(false)
  })

  it.each([
    ["http://localhost:3000/hub/auth/callback", "http://localhost:3000"],
    ["http://[::1]:3000/hub/auth/callback", "http://[::1]:3000"],
  ])(
    "accepts a loopback HTTP callback %s for local development",
    async (callback, origin) => {
      stubHubAuthEnv()
      vi.stubEnv("HUB_AUTH_CALLBACK_URI", callback)
      const { h3Event, location } = await beginLogin("/hub/data")

      expect(new URL(location).searchParams.get("redirect_uri")).toBe(callback)
      expect(hubAuthPublicOrigin()).toBe(origin)
      expect(loginCookie(h3Event)).not.toContain("Secure")
    }
  )

  it("rejects a plain HTTP callback on a non-loopback host", async () => {
    stubHubAuthEnv()
    vi.stubEnv(
      "HUB_AUTH_CALLBACK_URI",
      "http://hub.example.test/hub/auth/callback"
    )
    await expect(beginLogin("/hub/data")).rejects.toThrow(
      "Hub sign-in callback is not configured correctly."
    )
  })
})
