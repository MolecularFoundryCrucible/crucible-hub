import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { beginHubLogin, finishHubLogin } from "./hub-auth.server"
import {
  cancelHubLink,
  confirmHubLink,
  createHubLink,
  finishHubLinkCallback,
  previewHubLink,
} from "./hub-link.server"
import { CrucibleResponseError } from "./request-error.server"
import { oauthTokenAnswer } from "@/test/oauth"
import { startRequestScope } from "@/test/start-request"

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

async function signIn(accessToken = "access-1") {
  const login = startRequestScope("http://127.0.0.1:3000/hub/auth/login")
  const location = await login.run(() => beginHubLogin("/hub/"))
  const transaction = login
    .setCookies()
    .find((value) => value.startsWith("crucible_hub_login="))!
    .split(";")[0]
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        oauthTokenAnswer({ ...tokenResponse, access_token: accessToken })
      )
    )
  )
  const callback = startRequestScope(
    "http://127.0.0.1:3000/hub/auth/callback",
    { headers: { cookie: transaction } }
  )
  await callback.run(() =>
    finishHubLogin(
      "code",
      new URL(location).searchParams.get("state")!,
      null,
      "https://api.example.test"
    )
  )
  return callback
    .setCookies()
    .find((value) => value.startsWith("crucible_hub_session="))!
    .split(";")[0]
}

function inSession<T>(session: string | null, run: () => Promise<T>) {
  return startRequestScope("http://127.0.0.1:3000/hub/account", {
    headers: session ? { cookie: session } : {},
  }).run(run)
}

async function startLink(session: string) {
  return inSession(session, () => createHubLink("orcid"))
}

function stubApi(respond: (path: string, body: unknown) => Response) {
  const calls: { path: string; body: unknown; authorization: string }[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname
      const body: unknown = init?.body
        ? JSON.parse(String(init.body))
        : undefined
      calls.push({
        path,
        body,
        authorization: new Headers(init?.headers).get("Authorization") ?? "",
      })
      return respond(path, body)
    })
  )
  return calls
}

describe("linking another way to sign in", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-06T12:00:00.000Z"))
    stubHubAuthEnv()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("starts a link with PKCE and the Hub's link callback", async () => {
    const session = await signIn()
    const link = await startLink(session)
    expect(link.callbackUri).toBe(
      "http://127.0.0.1:3000/hub/auth/link/callback"
    )
    expect(link.state).toMatch(/^[\w-]{43}$/)
    expect(link.challenge).toMatch(/^[\w-]{43}$/)
  })

  it("keeps the code on the server and previews it with the session token", async () => {
    const session = await signIn()
    const { state } = await startLink(session)
    await expect(
      inSession(session, () =>
        finishHubLinkCallback({
          code: "link-code",
          error: null,
          iss: "https://api.example.test",
          state,
        })
      )
    ).resolves.toBe("pending")

    const calls = stubApi(() =>
      Response.json({
        label: null,
        orcid: "0000-0002-1825-0097",
        provider_key: "orcid",
        provider_name: "ORCID",
        status: "available",
      })
    )
    await expect(inSession(session, () => previewHubLink())).resolves.toEqual({
      label: null,
      orcid: "0000-0002-1825-0097",
      providerName: "ORCID",
      status: "available",
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.path).toBe("/oauth/link/preview")
    expect(calls[0]?.authorization).toMatch(/^Basic /)
    expect(calls[0]?.body).toMatchObject({
      code: "link-code",
      redirect_uri: "http://127.0.0.1:3000/hub/auth/link/callback",
      session_token: "access-1",
    })
  })

  it("treats an unexpected preview status as one that cannot be linked", async () => {
    const session = await signIn()
    const { state } = await startLink(session)
    await inSession(session, () =>
      finishHubLinkCallback({
        code: "link-code",
        error: null,
        iss: "https://api.example.test",
        state,
      })
    )
    stubApi(() => Response.json({ provider_name: "ORCID", status: "new" }))
    await expect(
      inSession(session, () => previewHubLink())
    ).resolves.toMatchObject({ status: "unknown" })
  })

  it("refuses a callback for another session", async () => {
    const owner = await signIn("access-1")
    const other = await signIn("access-2")
    const { state } = await startLink(owner)
    await expect(
      inSession(other, () =>
        finishHubLinkCallback({
          code: "link-code",
          error: null,
          iss: "https://api.example.test",
          state,
        })
      )
    ).resolves.toBe("expired")
    await expect(
      inSession(null, () =>
        finishHubLinkCallback({
          code: "link-code",
          error: null,
          iss: "https://api.example.test",
          state,
        })
      )
    ).resolves.toBe("signed-out")
  })

  it("refuses a callback whose state does not match", async () => {
    const session = await signIn()
    await startLink(session)
    await expect(
      inSession(session, () =>
        finishHubLinkCallback({
          code: "link-code",
          error: null,
          iss: "https://api.example.test",
          state: "wrong-state",
        })
      )
    ).resolves.toBe("failed")
    await expect(inSession(session, () => previewHubLink())).resolves.toBeNull()
  })

  it.each([["https://evil.example.test"], [null]])(
    "refuses and ends a link answered by issuer %s",
    async (iss) => {
      const session = await signIn()
      const { state } = await startLink(session)
      await expect(
        inSession(session, () =>
          finishHubLinkCallback({ code: "link-code", error: null, iss, state })
        )
      ).resolves.toBe("failed")
      await expect(
        inSession(session, () =>
          finishHubLinkCallback({
            code: "link-code",
            error: null,
            iss: "https://api.example.test",
            state,
          })
        )
      ).resolves.toBe("expired")
    }
  )

  it.each([
    ["login_required", "retry"],
    ["access_denied", "cancelled"],
    ["server_error", "failed"],
  ] as const)(
    "ends the link when the provider returns %s",
    async (error, outcome) => {
      const session = await signIn()
      const { state } = await startLink(session)
      await expect(
        inSession(session, () =>
          finishHubLinkCallback({
            code: null,
            error,
            iss: "https://api.example.test",
            state,
          })
        )
      ).resolves.toBe(outcome)
      await expect(
        inSession(session, () =>
          finishHubLinkCallback({
            code: "link-code",
            error: null,
            iss: "https://api.example.test",
            state,
          })
        )
      ).resolves.toBe("expired")
    }
  )

  it("expires a link after ten minutes", async () => {
    const session = await signIn()
    const { state } = await startLink(session)
    vi.setSystemTime(Date.now() + 10 * 60 * 1000 + 1)
    await expect(
      inSession(session, () =>
        finishHubLinkCallback({
          code: "link-code",
          error: null,
          iss: "https://api.example.test",
          state,
        })
      )
    ).resolves.toBe("expired")
  })

  it("confirms once and then forgets the link", async () => {
    const session = await signIn()
    const { state } = await startLink(session)
    await inSession(session, () =>
      finishHubLinkCallback({
        code: "link-code",
        error: null,
        iss: "https://api.example.test",
        state,
      })
    )
    const calls = stubApi(() => Response.json({ id: 2 }))
    await inSession(session, () => confirmHubLink())
    expect(calls.map((call) => call.path)).toEqual(["/oauth/link/confirm"])
    await expect(inSession(session, () => previewHubLink())).resolves.toBeNull()
  })

  it.each([
    [401, undefined, "link_expired"],
    [409, { detail: { code: "linked_elsewhere" } }, "linked_elsewhere"],
  ])(
    "reports a refused confirmation (%i) and forgets the link",
    async (status, body, code) => {
      const session = await signIn()
      const { state } = await startLink(session)
      await inSession(session, () =>
        finishHubLinkCallback({
          code: "link-code",
          error: null,
          iss: "https://api.example.test",
          state,
        })
      )
      stubApi(() =>
        body ? Response.json(body, { status }) : new Response(null, { status })
      )
      const failure: unknown = await inSession(session, () =>
        confirmHubLink()
      ).catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(CrucibleResponseError)
      expect((failure as CrucibleResponseError).conflictCode).toBe(code)
      await expect(
        inSession(session, () => previewHubLink())
      ).resolves.toBeNull()
    }
  )

  it("does not sign the person out when the link code is rejected", async () => {
    const session = await signIn()
    const { state } = await startLink(session)
    await inSession(session, () =>
      finishHubLinkCallback({
        code: "link-code",
        error: null,
        iss: "https://api.example.test",
        state,
      })
    )
    stubApi(() => new Response(null, { status: 401 }))
    await inSession(session, () => confirmHubLink()).catch(() => undefined)
    const next = await startLink(session)
    expect(next.state).toBeTruthy()
  })

  it("cancels a pending link", async () => {
    const session = await signIn()
    const { state } = await startLink(session)
    await inSession(session, () => cancelHubLink())
    await expect(
      inSession(session, () =>
        finishHubLinkCallback({
          code: "link-code",
          error: null,
          iss: "https://api.example.test",
          state,
        })
      )
    ).resolves.toBe("expired")
  })
})
