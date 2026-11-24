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
  hubApiAuthorizationUrl,
  hasHubSession,
  logoutHubSession,
  sessionApiFetch,
  sharedRequestPrivilegeMode,
  updateSharedPrivilegeMode,
  withHubAuthRequest,
} from "./hub-auth.server"
import { productionHubAuthReady } from "./hub-auth-config.server"
import {
  createHubLink,
  finishHubLinkCallback,
  previewHubLink,
} from "./hub-link.server"
import {
  checkPostgresSessionStore,
  closePostgresSessionPool,
} from "./hub-session-postgres.server"
import { readSession, replaceSession } from "./hub-session-store.server"
import { oauthRoute, oauthTokenAnswer } from "@/test/oauth"
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

async function signedInSession(
  respond: (path: string) => Response | Promise<Response>
) {
  const loginScope = startRequestScope("http://127.0.0.1:3000/hub/auth/login")
  const location = await loginScope.run(() => beginHubLogin("/hub/"))
  const state = new URL(location).searchParams.get("state")!
  const requests: string[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = oauthRoute(input, init)
      requests.push(path)
      if (path === "/oauth/token:authorization_code")
        return Response.json(oauthTokenAnswer(tokenResponse))
      if (path === "/oauth/revoke") return new Response(null)
      return respond(path)
    })
  )
  const loginCookie = loginScope
    .setCookies()
    .find((value) => value.startsWith("crucible_hub_login="))!
    .split(";")[0]!
  const callbackScope = startRequestScope(
    "http://127.0.0.1:3000/hub/auth/callback",
    { headers: { cookie: loginCookie } }
  )
  await callbackScope.run(() =>
    finishHubLogin("code", state, null, "https://api.example.test")
  )
  const sessionCookie = callbackScope
    .setCookies()
    .find((value) => value.startsWith("crucible_hub_session="))!
    .split(";")[0]!
  const sessionId = sessionCookie.slice("crucible_hub_session=".length)

  let currentCookie = sessionCookie
  const inRequest = <T>(work: () => Promise<T>, path = "/hub/data") => {
    const scope = startRequestScope(`http://127.0.0.1:3000${path}`, {
      headers: { cookie: currentCookie },
    })
    return scope
      .run(() => withHubAuthRequest(work))
      .finally(() => {
        const rotated = scope
          .setCookies()
          .find((value) => value.startsWith("crucible_hub_session="))
        if (rotated) currentCookie = rotated.split(";")[0]!
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
  return { call, inRequest, requests, sessionCookie, sessionId }
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
    vi.stubEnv("HUB_AUTH_SESSION_MODE", "single-instance")
    expect(productionHubAuthReady()).toBe(false)
    vi.stubEnv("HUB_AUTH_SESSION_MODE", "postgres")
    vi.stubEnv("HUB_SESSION_KEYS", "")
    expect(productionHubAuthReady()).toBe(false)
  })

  it("signs in over plain HTTP on this machine in production", async () => {
    stubSharedEnv()
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("HUB_AUTH_PRODUCTION_ENABLED", "true")
    vi.stubEnv("HUB_AUTH_SESSION_MODE", "postgres")
    vi.stubEnv("CRUCIBLE_API_BASE_URL", "http://127.0.0.1:8000/api")
    vi.stubEnv("HUB_AUTH_PUBLIC_API_URL", "http://localhost:8080/api")
    vi.stubEnv(
      "HUB_AUTH_CALLBACK_URI",
      "http://localhost:8080/hub/auth/callback"
    )
    const scope = startRequestScope("http://127.0.0.1:3000/hub/auth/login")
    const location = await scope.run(() => beginHubLogin("/hub/data"))

    expect(location.startsWith("http://localhost:8080/api/")).toBe(true)
    expect(
      scope
        .setCookies()
        .find((value) => value.startsWith("crucible_hub_login="))
    ).not.toContain("Secure")
    expect(
      hubApiAuthorizationUrl("http://localhost:8080/api/oauth/link/start")
    ).toBe("http://localhost:8080/api/oauth/link/start")
  })

  it("reaches the session table from a plain database URL in production", async () => {
    stubSharedEnv()
    vi.stubEnv("NODE_ENV", "production")
    await closePostgresSessionPool()
    await expect(checkPostgresSessionStore()).resolves.toBeUndefined()
  })

  it("keeps a pending sign-in link in the database for its own session only", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T22:00:00.000Z"))
    stubSharedEnv()
    const owner = await signedInSession((path) =>
      path === "/oauth/link/preview"
        ? Response.json({ provider_name: "ORCID", status: "available" })
        : new Response(null, { status: 404 })
    )
    const { state } = await owner.inRequest(() => createHubLink("orcid"))
    await expect(
      owner.inRequest(
        () =>
          finishHubLinkCallback({
            code: "link-code",
            error: null,
            iss: "https://api.example.test",
            state,
          }),
        "/hub/auth/link/callback"
      )
    ).resolves.toBe("pending")
    await expect(
      owner.inRequest(() => previewHubLink())
    ).resolves.toMatchObject({ providerName: "ORCID", status: "available" })
    const other = await signedInSession(() => new Response(null))
    await expect(
      other.inRequest(
        () =>
          finishHubLinkCallback({
            code: "link-code",
            error: null,
            iss: "https://api.example.test",
            state,
          }),
        "/hub/auth/link/callback"
      )
    ).resolves.toBe("expired")
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
    expect(requests).toEqual([
      "/oauth/token:authorization_code",
      "/datasets",
      "/datasets",
    ])
  })

  it("takes over a refresh claim abandoned by a stopped instance", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T23:00:30.000Z"))
    stubSharedEnv()
    const { call, inRequest, sessionId } = await signedInSession((path) =>
      path === "/oauth/token:refresh_token"
        ? Response.json(oauthTokenAnswer(refreshedTokens))
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
      if (path !== "/oauth/token:refresh_token") return Response.json([])
      refreshes += 1
      await new Promise((resolve) => setTimeout(resolve, 50))
      return Response.json(oauthTokenAnswer(refreshedTokens))
    })

    const results = await Promise.all([call(), call()])
    expect(results.map((result) => result.response?.status)).toEqual([200, 200])
    expect(refreshes).toBe(1)
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
    expect(requests).toContain("/oauth/revoke")
    const after = await call()
    expect(after.signedIn).toBe(false)
  })
})
