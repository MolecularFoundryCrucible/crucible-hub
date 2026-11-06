import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  beginHubLogin,
  enforceHubLoginRateLimit,
  finishHubLogin,
  hasHubSession,
  hubAuthPublicOrigin,
  hubSessionIdentity,
  hubApiAuthorizationUrl,
  hubSignInErrorReason,
  hubSignInFailureDetails,
  hubSignInMethods,
  hubSignInOrigin,
  sessionApiFetch,
} from "./hub-auth.server"
import { startRequestScope } from "@/test/start-request"
import type { StartRequestScope } from "@/test/start-request"

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
  const scope = startRequestScope(
    `http://127.0.0.1:3000/hub/auth/login${
      returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""
    }`
  )
  let location: string | undefined
  await scope.run(async () => {
    location = await beginHubLogin(returnTo)
  })
  return { scope, location: location! }
}

function loginCookie(scope: StartRequestScope): string {
  const cookie = scope
    .setCookies()
    .find((value) => value.startsWith("crucible_hub_login="))
  expect(cookie).toBeDefined()
  return cookie!
}

async function finishLogin(
  transactionCookie: string,
  code: string,
  state: string
) {
  const scope = startRequestScope("http://127.0.0.1:3000/hub/auth/callback", {
    headers: { cookie: transactionCookie.split(";")[0] },
  })
  const destination = await scope.run(() => finishHubLogin(code, state))
  return { destination, cookies: scope.setCookies() }
}

describe("hub login exchange", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("begins a login with PKCE parameters and completes it into a session", async () => {
    stubHubAuthEnv()
    const { scope, location } = await beginLogin("/hub/data")
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

    const transactionCookie = loginCookie(scope)
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
    const { scope, location } = await beginLogin(
      "https://evil.example/hub/data"
    )
    const transactionCookie = loginCookie(scope)
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
    const { scope } = await beginLogin("/hub/data")
    const transactionCookie = loginCookie(scope)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(tokenResponse))
    )
    await expect(
      finishLogin(transactionCookie, "code", "wrong-state-wrong-state-wrong-1")
    ).rejects.toThrow("The sign-in request could not be verified.")
  })

  describe("a callback that returns an error", () => {
    async function finishWithError(error: string, state?: string) {
      const { scope, location } = await beginLogin("/hub/data")
      const transactionCookie = loginCookie(scope)
      const fetch = vi.fn(async () => Response.json(tokenResponse))
      vi.stubGlobal("fetch", fetch)
      const callback = startRequestScope(
        "http://127.0.0.1:3000/hub/auth/callback",
        { headers: { cookie: transactionCookie.split(";")[0] } }
      )
      const failure: unknown = await callback
        .run(() =>
          finishHubLogin(
            null,
            state ?? new URL(location).searchParams.get("state")!,
            error
          )
        )
        .catch((reason: unknown) => reason)
      return { failure, fetch, transactionCookie, location }
    }

    it.each([
      "access_denied",
      "login_required",
      "temporarily_unavailable",
      "server_error",
    ])("reports %s without exchanging a code", async (error) => {
      stubHubAuthEnv()
      const { failure, fetch } = await finishWithError(error)
      expect(hubSignInFailureDetails(failure)).toEqual({
        reason: "provider-error",
        error,
      })
      expect(fetch).not.toHaveBeenCalled()
    })

    it("does not log an unrecognised error value", async () => {
      stubHubAuthEnv()
      const { failure } = await finishWithError("<script>")
      expect(hubSignInFailureDetails(failure)).toEqual({
        reason: "provider-error",
        error: "other",
      })
    })

    it("checks the state before trusting the error", async () => {
      stubHubAuthEnv()
      const { failure } = await finishWithError(
        "login_required",
        "wrong-state-wrong-state-wrong-1"
      )
      expect(hubSignInFailureDetails(failure)).toEqual({
        reason: "state-mismatch",
      })
    })

    it("ends the sign-in so its callback cannot be replayed", async () => {
      stubHubAuthEnv()
      const { transactionCookie, location } =
        await finishWithError("access_denied")
      const failure: unknown = await finishLogin(
        transactionCookie,
        "code",
        new URL(location).searchParams.get("state")!
      ).catch((reason: unknown) => reason)
      expect(hubSignInFailureDetails(failure)).toEqual({
        reason: "unknown-transaction",
      })
    })
  })

  it.each([
    [{ reason: "account-mismatch" }, "account-mismatch"],
    [{ reason: "provider-error", error: "login_required" }, "account-mismatch"],
    [{ reason: "stale-sign-in" }, "stale-sign-in"],
    [
      { reason: "provider-error", error: "temporarily_unavailable" },
      "unavailable",
    ],
    [{ reason: "provider-error", error: "server_error" }, "unavailable"],
    [{ reason: "provider-error", error: "access_denied" }, null],
    [{ reason: "expired-transaction" }, null],
  ] as const)("shows %o as the %s sign-in error", (details, expected) => {
    expect(hubSignInErrorReason(details)).toBe(expected)
  })

  it("consumes a sign-in transaction once", async () => {
    stubHubAuthEnv()
    const { scope, location } = await beginLogin("/hub/data")
    const transactionCookie = loginCookie(scope)
    const state = new URL(location).searchParams.get("state")!
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(tokenResponse))
    )
    await finishLogin(transactionCookie, "code", state)
    const failure: unknown = await finishLogin(
      transactionCookie,
      "code",
      state
    ).catch((error: unknown) => error)
    expect(failure).toMatchObject({
      message: "The sign-in request has expired.",
    })
    expect(hubSignInFailureDetails(failure)).toEqual({
      reason: "unknown-transaction",
    })
  })

  it("reports a callback that arrives without the login cookie", async () => {
    stubHubAuthEnv()
    const scope = startRequestScope("http://127.0.0.1:3000/hub/auth/callback")
    const failure: unknown = await scope
      .run(() => finishHubLogin("code", "state"))
      .catch((error: unknown) => error)
    expect(hubSignInFailureDetails(failure)).toEqual({
      reason: "missing-login-cookie",
    })
  })

  it("reports a callback that arrives after the login expired", async () => {
    stubHubAuthEnv()
    vi.useFakeTimers({ toFake: ["Date"] })
    const { scope, location } = await beginLogin("/hub/data")
    const transactionCookie = loginCookie(scope)
    const state = new URL(location).searchParams.get("state")!
    vi.setSystemTime(Date.now() + 11 * 60 * 1000)
    const failure: unknown = await finishLogin(
      transactionCookie,
      "code",
      state
    ).catch((error: unknown) => error)
    expect(hubSignInFailureDetails(failure)).toEqual({
      reason: "expired-transaction",
    })
  })

  it("does not count expired sign-ins toward the pending limit", async () => {
    stubHubAuthEnv()
    vi.useFakeTimers({ toFake: ["Date"] })
    const scope = startRequestScope("http://127.0.0.1:3000/hub/auth/login")
    await scope.run(async () => {
      for (let index = 0; index < 500; index += 1) {
        await beginHubLogin(null)
      }
    })
    vi.setSystemTime(Date.now() + 11 * 60 * 1000)
    await expect(
      scope.run(async () => enforceHubLoginRateLimit())
    ).resolves.toBeUndefined()
  })

  it("starts sign-in on the callback's address only with Hub sign-in on", () => {
    vi.stubEnv(
      "HUB_AUTH_CALLBACK_URI",
      "https://hub.example.test/hub/auth/callback"
    )
    expect(hubSignInOrigin()).toBeNull()
    vi.stubEnv("HUB_DATA_SOURCE", "hub-auth")
    expect(hubSignInOrigin()).toBe("https://hub.example.test")
  })

  it("rejects the callback when the token exchange is rejected", async () => {
    stubHubAuthEnv()
    const { scope, location } = await beginLogin("/hub/data")
    const transactionCookie = loginCookie(scope)
    const state = new URL(location).searchParams.get("state")!
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 401 }))
    )
    await expect(finishLogin(transactionCookie, "code", state)).rejects.toThrow(
      "The Crucible sign-in request failed."
    )
  })

  it("only sends the browser to the configured API", () => {
    stubHubAuthEnv()
    expect(
      hubApiAuthorizationUrl("https://api.example.test/auth/hub/link/start?t=1")
    ).toBe("https://api.example.test/auth/hub/link/start?t=1")
    for (const url of [
      "https://evil.example.test/auth/hub/link/start",
      "https://api.example.test.evil.example/start",
      "https://user@api.example.test/start",
      "http://api.example.test/start",
    ]) {
      expect(() => hubApiAuthorizationUrl(url)).toThrow()
    }
  })

  it("forwards the chosen sign-in provider", async () => {
    stubHubAuthEnv()
    const scope = startRequestScope("http://127.0.0.1:3000/hub/auth/login")
    const location = await scope.run(() =>
      beginHubLogin("/hub/", null, "orcid")
    )
    expect(new URL(location).searchParams.get("provider")).toBe("orcid")
  })

  describe("sign-in methods", () => {
    it("lists the methods the API offers", async () => {
      stubHubAuthEnv()
      const fetch = vi.fn(async () =>
        Response.json([
          { key: "orcid", display_name: "ORCID", is_orcid: true, kind: "oidc" },
          { key: "lbl", display_name: "Berkeley Lab", is_orcid: false },
        ])
      )
      vi.stubGlobal("fetch", fetch)
      await expect(hubSignInMethods()).resolves.toEqual([
        { key: "orcid", display_name: "ORCID", is_orcid: true },
        { key: "lbl", display_name: "Berkeley Lab", is_orcid: false },
      ])
      expect(String((fetch.mock.calls[0] as unknown[])[0])).toBe(
        "https://api.example.test/auth/methods"
      )
    })

    it.each([
      ["the request fails", () => Promise.reject(new TypeError("offline"))],
      [
        "the API answers with an error",
        async () => new Response(null, { status: 503 }),
      ],
      ["the response is malformed", async () => Response.json([{ key: 1 }])],
    ])("returns nothing when %s", async (_label, respond) => {
      stubHubAuthEnv()
      vi.stubGlobal("fetch", vi.fn(respond))
      await expect(hubSignInMethods()).resolves.toBeNull()
    })

    it("does not ask without Hub sign-in", async () => {
      stubHubAuthEnv()
      vi.stubEnv("HUB_DATA_SOURCE", "fixture")
      const fetch = vi.fn()
      vi.stubGlobal("fetch", fetch)
      await expect(hubSignInMethods()).resolves.toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  it("forwards max_age to force ORCID re-authentication", async () => {
    stubHubAuthEnv()
    const scope = startRequestScope("http://127.0.0.1:3000/hub/auth/login")
    const location = await scope.run(() => beginHubLogin("/hub/account", 0))
    expect(new URL(location).searchParams.get("max_age")).toBe("0")
  })

  describe("re-confirming a sign-in", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(new Date("2026-10-06T12:00:00.000Z"))
    })

    async function signIn(account: string) {
      const { scope, location } = await beginLogin("/hub/data")
      const state = new URL(location).searchParams.get("state")!
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({ ...tokenResponse, user_unique_id: account })
        )
      )
      const { cookies } = await finishLogin(loginCookie(scope), "code", state)
      return cookies
        .find((value) => value.startsWith("crucible_hub_session="))!
        .split(";")[0]
    }

    async function stepUp(
      session: string,
      returning: string,
      authTime: string | null = new Date().toISOString()
    ) {
      const scope = startRequestScope(
        "http://127.0.0.1:3000/hub/auth/login?max_age=0",
        { headers: { cookie: session } }
      )
      const location = await scope.run(() =>
        beginHubLogin("/hub/reauthenticated", 0)
      )
      const state = new URL(location).searchParams.get("state")!
      const requests: string[] = []
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL | Request) => {
          const path = new URL(String(input)).pathname
          requests.push(path)
          return path === "/auth/hub/token"
            ? Response.json({
                ...tokenResponse,
                auth_time: authTime,
                refresh_token: "refresh-2",
                user_unique_id: returning,
              })
            : new Response(null)
        })
      )
      const callback = startRequestScope(
        "http://127.0.0.1:3000/hub/auth/callback",
        {
          headers: {
            cookie: `${session}; ${loginCookie(scope).split(";")[0]}`,
          },
        }
      )
      const finished = callback.run(() => finishHubLogin("code", state))
      return { callback, finished, location, requests }
    }

    async function expectSessionKept(session: string) {
      const original = startRequestScope("http://127.0.0.1:3000/hub/data", {
        headers: { cookie: session },
      })
      await expect(
        original.run(async () => hubSessionIdentity())
      ).resolves.toBe("0000-0000-0000-000X")
    }

    it("asks the API for the signed-in account", async () => {
      stubHubAuthEnv()
      const session = await signIn("0000-0000-0000-000X")
      const { finished, location } = await stepUp(
        session,
        "0000-0000-0000-000X"
      )
      await finished
      expect(new URL(location).searchParams.get("required_user")).toBe(
        "0000-0000-0000-000X"
      )
    })

    it.each([
      [
        "an earlier sign-in",
        () => new Date(Date.now() - 120_000).toISOString(),
      ],
      ["no sign-in time", () => null],
    ])(
      "keeps the session and revokes the tokens when the API reports %s",
      async (_label, authTime) => {
        stubHubAuthEnv()
        const session = await signIn("0000-0000-0000-000X")
        const { callback, finished, requests } = await stepUp(
          session,
          "0000-0000-0000-000X",
          authTime()
        )
        const error = await finished.catch((reason: unknown) => reason)
        expect(hubSignInFailureDetails(error)).toEqual({
          reason: "stale-sign-in",
        })
        expect(requests).toEqual(["/auth/hub/token", "/auth/hub/revoke"])
        expect(
          callback
            .setCookies()
            .some((value) => value.startsWith("crucible_hub_session="))
        ).toBe(false)
        await expectSessionKept(session)
      }
    )

    it("accepts a sign-in time rounded down to the second", async () => {
      stubHubAuthEnv()
      const session = await signIn("0000-0000-0000-000X")
      const { finished } = await stepUp(
        session,
        "0000-0000-0000-000X",
        new Date(Math.floor(Date.now() / 1000) * 1000 - 1000)
          .toISOString()
          .replace(/\.\d+Z$/, "Z")
      )
      await expect(finished).resolves.toBe("/hub/reauthenticated")
    })

    it("replaces the session when the same account returns", async () => {
      stubHubAuthEnv()
      const session = await signIn("0000-0000-0000-000X")
      const { callback, finished, requests } = await stepUp(
        session,
        "0000-0000-0000-000X"
      )
      await expect(finished).resolves.toBe("/hub/reauthenticated")
      expect(requests).toEqual(["/auth/hub/token"])
      expect(
        callback
          .setCookies()
          .some((value) => /^crucible_hub_session=./.test(value))
      ).toBe(true)
    })

    it("keeps the session and revokes the tokens when another account returns", async () => {
      stubHubAuthEnv()
      const session = await signIn("0000-0000-0000-000X")
      const { callback, finished, requests } = await stepUp(
        session,
        "mfid-other-account"
      )
      const error = await finished.catch((reason: unknown) => reason)
      expect(hubSignInFailureDetails(error)).toEqual({
        reason: "account-mismatch",
      })
      expect(requests).toEqual(["/auth/hub/token", "/auth/hub/revoke"])
      expect(
        callback
          .setCookies()
          .some((value) => value.startsWith("crucible_hub_session="))
      ).toBe(false)
      const original = startRequestScope("http://127.0.0.1:3000/hub/data", {
        headers: { cookie: session },
      })
      await expect(
        original.run(async () => hubSessionIdentity())
      ).resolves.toBe("0000-0000-0000-000X")
    })

    it("does not restrict a plain sign-in or a step-up without a session", async () => {
      stubHubAuthEnv()
      const scope = startRequestScope(
        "http://127.0.0.1:3000/hub/auth/login?max_age=0"
      )
      const location = await scope.run(() => beginHubLogin("/hub/", 0))
      const state = new URL(location).searchParams.get("state")!
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({ ...tokenResponse, user_unique_id: "mfid-any" })
        )
      )
      await expect(
        finishLogin(loginCookie(scope), "code", state)
      ).resolves.toMatchObject({ destination: "/hub/" })
    })
  })

  it("keeps the session when the API requires a recent sign-in", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T12:00:00.000Z"))
    stubHubAuthEnv()
    const { scope, location } = await beginLogin("/hub/")
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
    const { cookies } = await finishLogin(loginCookie(scope), "code", state)
    const sessionCookie = cookies
      .find((value) => value.startsWith("crucible_hub_session="))!
      .split(";")[0]

    const apiScope = startRequestScope("http://127.0.0.1:3000/hub/account", {
      headers: { cookie: sessionCookie },
    })
    await apiScope.run(async () => {
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
    const { scope, location } = await beginLogin("/hub/")
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
    const { cookies } = await finishLogin(loginCookie(scope), "code", state)
    const sessionCookie = cookies
      .find((value) => value.startsWith("crucible_hub_session="))!
      .split(";")[0]
    const call = () => {
      const apiScope = startRequestScope("http://127.0.0.1:3000/hub/data", {
        headers: { cookie: sessionCookie },
      })
      return apiScope.run(async () => {
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
      const { scope, location } = await beginLogin("/hub/data")

      expect(new URL(location).searchParams.get("redirect_uri")).toBe(callback)
      expect(hubAuthPublicOrigin()).toBe(origin)
      expect(loginCookie(scope)).not.toContain("Secure")
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
