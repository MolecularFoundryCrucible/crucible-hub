import { randomBytes } from "node:crypto"

import { Client } from "pg"
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import {
  beginHubLogin,
  finishHubLogin,
  hasHubSession,
  logoutHubSession,
  productionHubAuthReady,
  sessionApiFetch,
  sharedRequestPrivilegeMode,
  updateSharedPrivilegeMode,
  withHubAuthRequest,
} from "./hub-auth.server"
import {
  checkPostgresSessionStore,
  closePostgresSessionPool,
} from "./hub-session-postgres.server"
import { readSession, replaceSession } from "./hub-session-store.server"
import { startRequestScope } from "@/test/start-request"

const databaseUrl = process.env.HUB_TEST_SESSION_DATABASE_URL
const sessionKeys = `k1:${randomBytes(32).toString("base64url")}`

const tokenResponse = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  access_expires_at: "2026-10-06T23:00:00.000Z",
  refresh_expires_at: "2026-11-06T00:00:00.000Z",
  token_type: "Bearer",
  user_unique_id: "0000-0000-0000-000X",
}

const refreshedTokens = {
  ...tokenResponse,
  access_token: "access-2",
  access_expires_at: "2026-10-06T23:15:30.000Z",
  refresh_token: "refresh-2",
}

function stubSharedEnv() {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("HUB_DATA_SOURCE", "hub-auth")
  vi.stubEnv("CRUCIBLE_API_BASE_URL", "https://api.example.test")
  vi.stubEnv("HUB_AUTH_CLIENT_SECRET", "test-secret")
  vi.stubEnv("HUB_SESSION_DATABASE_URL", databaseUrl)
  vi.stubEnv("HUB_SESSION_KEYS", sessionKeys)
}

function pathOf(input: string | URL | Request) {
  return new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  ).pathname
}

async function signedInSession(
  respond: (path: string) => Response | Promise<Response>
) {
  const loginScope = startRequestScope("http://127.0.0.1:3000/hub/auth/login")
  const location = await loginScope.run(() => beginHubLogin("/hub/"))
  const state = new URL(location).searchParams.get("state")!
  const requests: string[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const path = pathOf(input)
      requests.push(path)
      if (path === "/auth/hub/token") return Response.json(tokenResponse)
      if (path === "/auth/hub/revoke") return new Response(null)
      return respond(path)
    })
  )
  const loginCookie = loginScope
    .setCookies()
    .find((value) => value.startsWith("crucible_hub_login="))!
    .split(";")[0]
  const callbackScope = startRequestScope(
    "http://127.0.0.1:3000/hub/auth/callback",
    { headers: { cookie: loginCookie } }
  )
  await callbackScope.run(() => finishHubLogin("code", state))
  const sessionCookie = callbackScope
    .setCookies()
    .find((value) => value.startsWith("crucible_hub_session="))!
    .split(";")[0]
  const sessionId = sessionCookie.slice("crucible_hub_session=".length)

  let currentCookie = sessionCookie
  const inRequest = <T>(work: () => Promise<T>) => {
    const scope = startRequestScope("http://127.0.0.1:3000/hub/data", {
      headers: { cookie: currentCookie },
    })
    return scope
      .run(() => withHubAuthRequest(work))
      .finally(() => {
        const rotated = scope
          .setCookies()
          .find((value) => value.startsWith("crucible_hub_session="))
        if (rotated) currentCookie = rotated.split(";")[0]
      })
  }
  const call = () =>
    inRequest(async () => {
      try {
        const response = await sessionApiFetch()(
          "https://api.example.test/datasets"
        )
        return { response, signedIn: hasHubSession() }
      } catch (error) {
        return { error, signedIn: hasHubSession() }
      }
    })
  return { call, inRequest, requests, sessionId }
}

describe.skipIf(!databaseUrl)("Hub sessions shared through Postgres", () => {
  beforeEach(async () => {
    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    await client.query(
      "delete from hub.session_entries where key like 'crucible:hub:%'"
    )
    await client.end()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  afterAll(async () => {
    await closePostgresSessionPool()
  })

  it("is ready for production only with a configured Postgres store", () => {
    stubSharedEnv()
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_AUTH_PRODUCTION_ENABLED", "true")
    vi.stubEnv("HUB_AUTH_SESSION_MODE", "postgres")
    expect(productionHubAuthReady()).toBe(true)
    vi.stubEnv("HUB_AUTH_SESSION_MODE", "redis")
    expect(productionHubAuthReady()).toBe(false)
    vi.stubEnv("HUB_AUTH_SESSION_MODE", "postgres")
    vi.stubEnv("HUB_SESSION_KEYS", "")
    expect(productionHubAuthReady()).toBe(false)
  })

  it("reaches the session table from a plain database URL in production", async () => {
    stubSharedEnv()
    vi.stubEnv("NODE_ENV", "production")
    await closePostgresSessionPool()
    await expect(checkPostgresSessionStore()).resolves.toBeUndefined()
  })

  it("keeps a signed-in session across requests through the database", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T22:00:00.000Z"))
    stubSharedEnv()
    const { call, requests } = await signedInSession(() => Response.json([]))

    const first = await call()
    const second = await call()
    expect(first.response?.status).toBe(200)
    expect(second.signedIn).toBe(true)
    expect(requests).toEqual(["/auth/hub/token", "/datasets", "/datasets"])
  })

  it("keeps the session and the current access token when a refresh is rate limited", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T22:59:45.000Z"))
    stubSharedEnv()
    const { call, requests } = await signedInSession((path) =>
      path === "/auth/hub/refresh"
        ? new Response(null, { headers: { "Retry-After": "20" }, status: 429 })
        : Response.json([])
    )

    const first = await call()
    const second = await call()
    expect(first.response?.status).toBe(200)
    expect(second.response?.status).toBe(200)
    expect(second.signedIn).toBe(true)
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
    stubSharedEnv()
    let refreshes = 0
    const { call } = await signedInSession((path) => {
      if (path !== "/auth/hub/refresh") return Response.json([])
      refreshes += 1
      return refreshes === 1
        ? new Response(null, { headers: { "Retry-After": "10" }, status: 429 })
        : Response.json(refreshedTokens)
    })

    const failed = await call()
    expect(failed.error).toMatchObject({ status: 429 })
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

  it("takes over a refresh claim abandoned by a stopped instance", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T23:00:30.000Z"))
    stubSharedEnv()
    const { call, inRequest, sessionId } = await signedInSession((path) =>
      path === "/auth/hub/refresh"
        ? Response.json(refreshedTokens)
        : Response.json([])
    )
    await inRequest(async () => {
      const current = (await readSession(sessionId))!
      await replaceSession(sessionId, current, {
        ...current.session,
        refreshing: true,
        refreshingSince: Date.now() - 60_000,
      })
    })

    const result = await call()
    expect(result.response?.status).toBe(200)
    expect(result.signedIn).toBe(true)
  })

  it("lets one of two concurrent requests refresh the tokens", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T23:00:30.000Z"))
    stubSharedEnv()
    let refreshes = 0
    const { call } = await signedInSession(async (path) => {
      if (path !== "/auth/hub/refresh") return Response.json([])
      refreshes += 1
      await new Promise((resolve) => setTimeout(resolve, 50))
      return Response.json(refreshedTokens)
    })

    const results = await Promise.all([call(), call()])
    expect(results.map((result) => result.response?.status)).toEqual([200, 200])
    expect(refreshes).toBe(1)
  })

  it("closes the session after an uncertain refresh", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T23:00:30.000Z"))
    stubSharedEnv()
    const { call } = await signedInSession((path) =>
      path === "/auth/hub/refresh"
        ? new Response(null, { status: 504 })
        : Response.json([])
    )

    const result = await call()
    expect(result.error).toBeInstanceOf(Error)
    expect(result.signedIn).toBe(false)
  })

  it("keeps a session for days and returns administrator mode to normal after twelve hours", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T22:00:00.000Z"))
    stubSharedEnv()
    const { inRequest } = await signedInSession(() => Response.json([]))

    await inRequest(() => updateSharedPrivilegeMode("elevated"))
    expect(await inRequest(async () => sharedRequestPrivilegeMode())).toBe(
      "elevated"
    )

    vi.setSystemTime(new Date("2026-10-07T10:00:01.000Z"))
    expect(
      await inRequest(async () => ({
        mode: sharedRequestPrivilegeMode(),
        signedIn: hasHubSession(),
      }))
    ).toEqual({ mode: "normal", signedIn: true })
  })

  it("removes the session and revokes its refresh token on logout", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T22:00:00.000Z"))
    stubSharedEnv()
    const { call, inRequest, requests } = await signedInSession(() =>
      Response.json([])
    )

    expect(await inRequest(() => logoutHubSession())).toBe(true)
    expect(requests).toContain("/auth/hub/revoke")
    const after = await call()
    expect(after.signedIn).toBe(false)
  })
})
