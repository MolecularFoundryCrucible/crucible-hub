import "@tanstack/react-start/server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { AsyncLocalStorage } from "node:async_hooks"
import {
  deleteCookie,
  getCookie,
  getRequest,
  getRequestHeader,
  getRequestIP,
  setCookie,
} from "@tanstack/react-start/server"
import { z } from "zod"
import { clientAddress } from "./deployment-settings.server"
import { clearLegacyPrivilegeModeCookie } from "./privilege-mode-cookie.server"
import {
  cancelTransaction,
  closeSession,
  consumeTransaction,
  createSessionAfterCallback,
  newSharedSession,
  readSession,
  replaceSession,
  rotateSession,
  saveTransaction,
  sessionPrivilegeMode,
  sharedSessionsConfigured,
  sharedSessionsRequested,
  touchSession,
} from "./hub-session-store.server"
import type { SharedSession } from "./hub-session-store.server"
import {
  CrucibleResponseError,
  isStepUpChallenge,
} from "./request-error.server"
import { readRetryAfterSeconds } from "@/lib/retry-after"
import { backgroundRequestHeader } from "@/data/crucible/background-request"

import {
  TokenRequestError,
  HubAccountMismatchError,
  HubLoginUnavailableError,
  HubStaleSignInError,
  HubSignInRefusedError,
  HubLoginRateLimitError,
} from "./hub-auth-errors.server"
import {
  configuredCallbackUri,
  hubAuthPublicOrigin,
  cookieOptions,
  hubAuthConfig,
} from "./hub-auth-config.server"

const clientId = "crucible-hub"
const sessionCookie = "crucible_hub_session"
const transactionCookie = "crucible_hub_login"
const transactionLifetime = 10 * 60 * 1000
const authTimeTolerance = 30 * 1000
const sessionIdleLifetime = 7 * 24 * 60 * 60 * 1000
const sessionAbsoluteLifetime = 30 * 24 * 60 * 60 * 1000

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  access_expires_at: z.iso.datetime({ offset: true }),
  refresh_expires_at: z.iso.datetime({ offset: true }),
  token_type: z.literal("Bearer").default("Bearer"),
  user_unique_id: z.string().min(1),
  auth_time: z.iso.datetime({ offset: true }).nullable().optional(),
})

type Tokens = z.infer<typeof tokenSchema>

const oauthTokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().nonnegative(),
  refresh_expires_in: z.number().int().nonnegative(),
  user_unique_id: z.string().min(1),
  auth_time: z.number().int().nonnegative().optional(),
})

function storedTokens(
  answer: z.infer<typeof oauthTokenSchema>,
  receivedAt: number
): Tokens {
  return tokenSchema.parse({
    access_token: answer.access_token,
    refresh_token: answer.refresh_token,
    access_expires_at: new Date(
      receivedAt + answer.expires_in * 1000
    ).toISOString(),
    refresh_expires_at: new Date(
      receivedAt + answer.refresh_expires_in * 1000
    ).toISOString(),
    token_type: answer.token_type,
    user_unique_id: answer.user_unique_id,
    auth_time:
      answer.auth_time === undefined
        ? null
        : new Date(answer.auth_time * 1000).toISOString(),
  })
}

type TokenGrant =
  | {
      grant_type: "authorization_code"
      code: string
      code_verifier: string
      redirect_uri: string
    }
  | { grant_type: "refresh_token"; refresh_token: string }
type Transaction = {
  state: string
  verifier: string
  returnTo: string
  expiresAt: number
  expectedAccount?: string
  maxAge?: number
  consumed: boolean
  cancelled: boolean
}

type Session = {
  tokens: Tokens
  expiresAt: number
  idleExpiresAt: number
  refreshRetryAt?: number
}

type Store = {
  transactions: Map<string, Transaction>
  sessions: Map<string, Session>
  refreshes: Map<string, Promise<Tokens | null>>
}

const transientRefreshDelay = 5000
const refreshClaimLifetime = 30_000

function refreshClaimed(shared: SharedSession) {
  return (
    shared.refreshing &&
    (shared.refreshingSince ?? 0) > Date.now() - refreshClaimLifetime
  )
}

function refreshFailure(error: unknown) {
  return {
    transient: error instanceof TokenRequestError && error.status === 429,
    retryAfterMs:
      error instanceof TokenRequestError &&
      error.retryAfterSeconds !== undefined
        ? error.retryAfterSeconds * 1000
        : transientRefreshDelay,
  }
}

function refreshUnavailable(retryAfterMs: number) {
  return new CrucibleResponseError(
    new Response(null, {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
      },
    })
  )
}

const storeKey = Symbol.for("crucible.hub.auth.local-store")
const globals = globalThis as typeof globalThis & { [storeKey]?: Store }
const store = (globals[storeKey] ??= {
  transactions: new Map(),
  sessions: new Map(),
  refreshes: new Map(),
})

const requestSession = new AsyncLocalStorage<{
  session: SharedSession | null
}>()

const loginRateLimit = 30
const loginRateWindow = 10 * 60 * 1000
const maxPendingTransactions = 500
const maxTrackedLoginClients = 1000
const loginAttempts = new Map<string, number[]>()

function pruneExpiredLocalTransactions() {
  const now = Date.now()
  for (const [id, transaction] of store.transactions) {
    if (transaction.expiresAt < now) store.transactions.delete(id)
  }
}

export function enforceHubLoginRateLimit() {
  const forwardedFor = getRequestHeader("x-forwarded-for")
  const ip = clientAddress(forwardedFor, getRequestIP()) ?? "unknown"
  const now = Date.now()
  if (loginAttempts.size >= maxTrackedLoginClients) {
    for (const [client, timestamps] of loginAttempts) {
      if (timestamps.every((timestamp) => now - timestamp >= loginRateWindow)) {
        loginAttempts.delete(client)
      }
    }
  }
  if (!sharedMode()) pruneExpiredLocalTransactions()
  const attempts = (loginAttempts.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < loginRateWindow
  )
  if (
    attempts.length >= loginRateLimit ||
    store.transactions.size >= maxPendingTransactions
  ) {
    throw new HubLoginRateLimitError()
  }
  attempts.push(now)
  loginAttempts.set(ip, attempts)
}

function localSession(id: string, touch = false) {
  const current = store.sessions.get(id)
  if (!current) return null
  const now = Date.now()
  if (
    !Number.isFinite(current.expiresAt) ||
    !Number.isFinite(current.idleExpiresAt) ||
    current.expiresAt <= now ||
    current.idleExpiresAt <= now ||
    Date.parse(current.tokens.refresh_expires_at) <= now
  ) {
    store.sessions.delete(id)
    return null
  }
  if (touch)
    current.idleExpiresAt = Math.min(
      now + sessionIdleLifetime,
      current.expiresAt
    )
  return current
}

function clearSharedRequestSession() {
  const context = requestSession.getStore()
  if (context) context.session = null
}

function sharedMode() {
  if (
    process.env.HUB_DATA_SOURCE === "hub-auth" &&
    sharedSessionsRequested() &&
    !sharedSessionsConfigured()
  ) {
    throw new Error("Shared Hub sessions are not configured.")
  }
  return (
    process.env.HUB_DATA_SOURCE === "hub-auth" && sharedSessionsConfigured()
  )
}

export async function withHubAuthRequest<T>(
  next: () => T | Promise<T>
): Promise<T> {
  if (!sharedMode()) return await next()
  const request = getRequest()
  const path = new URL(request.url).pathname
  if (
    (path.startsWith("/hub/auth/") && !path.startsWith("/hub/auth/link/")) ||
    path === "/hub/health" ||
    request.headers.get(backgroundRequestHeader) === "1"
  ) {
    return await next()
  }
  const id = getCookie(sessionCookie)
  const current = id ? await readSession(id) : null
  const activeSession = id && current ? await touchSession(id, current) : null
  return await requestSession.run({ session: activeSession }, next)
}

export function sharedRequestPrivilegeMode() {
  if (!sharedMode()) return null
  const current = requestSession.getStore()?.session
  return current ? sessionPrivilegeMode(current) : "normal"
}

export async function updateSharedPrivilegeMode(mode: "normal" | "elevated") {
  if (!sharedMode()) return false
  const id = getCookie(sessionCookie)
  if (!id) throw new Error("Sign in to Crucible Hub to continue.")
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readSession(id)
    if (!current) throw new Error("The Hub session has ended.")
    if (refreshClaimed(current.session))
      throw new Error("The Hub session is refreshing. Try again.")
    const updated = {
      ...current.session,
      privilegeMode: mode,
      elevatedAt: mode === "elevated" ? Date.now() : undefined,
    }
    const nextId = randomValue()
    if (await rotateSession(id, nextId, current, updated)) {
      setCookie(sessionCookie, nextId, sessionCookieOptions())
      const context = requestSession.getStore()
      if (context) context.session = updated
      return true
    }
  }
  throw new Error("The Hub session changed. Try again.")
}

async function resetPrivilegeMode() {
  if (!(await updateSharedPrivilegeMode("normal"))) {
    clearLegacyPrivilegeModeCookie()
  }
}

function randomValue() {
  return randomBytes(32).toString("base64url")
}

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/hub/") || value.startsWith("//")) {
    return "/hub/"
  }
  try {
    const origin = configuredCallbackUri()
    const target = new URL(value, origin)
    if (
      target.origin !== new URL(origin).origin ||
      !target.pathname.startsWith("/hub/") ||
      target.pathname.startsWith("/hub/auth/")
    ) {
      return "/hub/"
    }
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return "/hub/"
  }
}

function sessionCookieOptions() {
  return { ...cookieOptions("/hub"), maxAge: sessionAbsoluteLifetime / 1000 }
}

function basicAuthorization(secret: string) {
  return `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`
}

async function tokenRequest(grant: TokenGrant): Promise<Tokens> {
  const { baseUrl, secret } = hubAuthConfig()
  const sentAt = Date.now()
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthorization(secret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(grant),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok)
    throw new TokenRequestError(
      response.status,
      readRetryAfterSeconds(response.headers)
    )
  return storedTokens(oauthTokenSchema.parse(await response.json()), sentAt)
}

async function currentAccount() {
  const sessionId = getCookie(sessionCookie)
  if (!sessionId) return undefined
  return sharedMode()
    ? (await readSession(sessionId))?.session.tokens.user_unique_id
    : localSession(sessionId)?.tokens.user_unique_id
}

async function rejectOtherAccount(
  expectedAccount: string | undefined,
  tokens: Tokens
) {
  if (!expectedAccount || tokens.user_unique_id === expectedAccount) return
  await revokeRefreshToken(tokens.refresh_token)
  throw new HubAccountMismatchError()
}

async function rejectStaleSignIn(
  transaction: Pick<Transaction, "expectedAccount" | "expiresAt" | "maxAge">,
  tokens: Tokens
) {
  if (!transaction.expectedAccount || transaction.maxAge === undefined) return
  const startedAt = transaction.expiresAt - transactionLifetime
  const authTime = Date.parse(tokens.auth_time ?? "")
  if (
    Number.isFinite(authTime) &&
    authTime >= startedAt - transaction.maxAge * 1000 - authTimeTolerance
  ) {
    return
  }
  await revokeRefreshToken(tokens.refresh_token)
  throw new HubStaleSignInError()
}

export async function beginHubLogin(
  returnTo: string | null,
  maxAge: number | null = null,
  provider: string | null = null
) {
  const { publicBaseUrl, callbackUri } = hubAuthConfig()
  if (!sharedMode()) {
    pruneExpiredLocalTransactions()
    for (const id of store.sessions.keys()) localSession(id)
  }
  const state = randomValue()
  const verifier = randomValue()
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  const transactionId = randomValue()
  const expectedAccount = maxAge === null ? undefined : await currentAccount()
  const transaction = {
    state,
    verifier,
    returnTo: safeReturnTo(returnTo),
    expiresAt: Date.now() + transactionLifetime,
    ...(expectedAccount ? { expectedAccount } : {}),
    ...(maxAge === null ? {} : { maxAge }),
    consumed: false,
    cancelled: false,
  }
  if (sharedMode()) await saveTransaction(transactionId, transaction)
  else store.transactions.set(transactionId, transaction)
  setCookie(transactionCookie, transactionId, {
    ...cookieOptions("/hub/auth"),
    maxAge: transactionLifetime / 1000,
  })
  const url = new URL(`${publicBaseUrl}/oauth/authorize`)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", callbackUri)
  url.searchParams.set("state", state)
  url.searchParams.set("code_challenge", challenge)
  url.searchParams.set("code_challenge_method", "S256")
  if (maxAge !== null) url.searchParams.set("max_age", String(maxAge))
  if (expectedAccount) url.searchParams.set("required_user", expectedAccount)
  if (provider) url.searchParams.set("provider", provider)
  return url.toString()
}

export function hubIssuerMatches(issuer: string | null) {
  const configured =
    process.env.HUB_AUTH_PUBLIC_API_URL ?? process.env.CRUCIBLE_API_BASE_URL
  return (
    issuer !== null &&
    configured !== undefined &&
    issuer === configured.replace(/\/+$/, "")
  )
}

export async function finishHubLogin(
  code: string | null,
  state: string,
  providerError: string | null,
  issuer: string | null
) {
  const { callbackUri } = hubAuthConfig()
  const transactionId = getCookie(transactionCookie)
  deleteCookie(transactionCookie, cookieOptions("/hub/auth"))
  if (!transactionId) throw new HubLoginUnavailableError("missing-login-cookie")
  if (sharedMode()) {
    const transaction = await consumeTransaction(transactionId)
    if (!transaction) throw new HubLoginUnavailableError("unknown-transaction")
    if (transaction.expiresAt < Date.now()) {
      throw new HubLoginUnavailableError("expired-transaction")
    }
    const expected = Buffer.from(transaction.state)
    const actual = Buffer.from(state)
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new Error("The sign-in request could not be verified.")
    }
    if (!hubIssuerMatches(issuer)) {
      throw new Error("The sign-in response came from another server.")
    }
    if (providerError !== null || code === null) {
      throw new HubSignInRefusedError(providerError ?? "")
    }
    const tokens = await tokenRequest({
      grant_type: "authorization_code",
      code,
      code_verifier: transaction.verifier,
      redirect_uri: callbackUri,
    })
    await rejectOtherAccount(transaction.expectedAccount, tokens)
    await rejectStaleSignIn(transaction, tokens)
    const sessionId = randomValue()
    const previousId = getCookie(sessionCookie) ?? null
    const previous = previousId ? await readSession(previousId) : null
    const created = newSharedSession(tokens)
    if (
      transaction.expectedAccount &&
      previous?.session.tokens.user_unique_id === tokens.user_unique_id
    ) {
      created.privilegeMode = previous.session.privilegeMode
      created.elevatedAt = previous.session.elevatedAt
    }
    let accepted: boolean
    try {
      accepted = await createSessionAfterCallback(
        transactionId,
        sessionId,
        previousId,
        created
      )
    } catch (error) {
      await revokeRefreshToken(tokens.refresh_token)
      throw error
    }
    if (!accepted) {
      await revokeRefreshToken(tokens.refresh_token)
      throw new HubLoginUnavailableError("cancelled-transaction")
    }
    if (previous)
      await revokeRefreshToken(previous.session.tokens.refresh_token)
    clearLegacyPrivilegeModeCookie()
    setCookie(sessionCookie, sessionId, sessionCookieOptions())
    return transaction.returnTo
  }
  const transaction = store.transactions.get(transactionId)
  if (!transaction) throw new HubLoginUnavailableError("unknown-transaction")
  if (transaction.cancelled) {
    throw new HubLoginUnavailableError("cancelled-transaction")
  }
  if (transaction.consumed) {
    throw new HubLoginUnavailableError("reused-transaction")
  }
  if (transaction.expiresAt < Date.now()) {
    throw new HubLoginUnavailableError("expired-transaction")
  }
  transaction.consumed = true
  try {
    const expected = Buffer.from(transaction.state)
    const actual = Buffer.from(state)
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new Error("The sign-in request could not be verified.")
    }
    if (!hubIssuerMatches(issuer)) {
      throw new Error("The sign-in response came from another server.")
    }
    if (providerError !== null || code === null) {
      throw new HubSignInRefusedError(providerError ?? "")
    }
    const tokens = await tokenRequest({
      grant_type: "authorization_code",
      code,
      code_verifier: transaction.verifier,
      redirect_uri: callbackUri,
    })
    await rejectOtherAccount(transaction.expectedAccount, tokens)
    await rejectStaleSignIn(transaction, tokens)
    if (
      transaction.cancelled ||
      store.transactions.get(transactionId) !== transaction
    ) {
      await revokeRefreshToken(tokens.refresh_token)
      throw new HubLoginUnavailableError("cancelled-transaction")
    }
    const previousId = getCookie(sessionCookie)
    const previous = previousId ? store.sessions.get(previousId) : undefined
    if (previousId) store.sessions.delete(previousId)
    const sessionId = randomValue()
    const now = Date.now()
    store.sessions.set(sessionId, {
      tokens,
      expiresAt: now + sessionAbsoluteLifetime,
      idleExpiresAt: now + sessionIdleLifetime,
    })
    if (previous) await revokeRefreshToken(previous.tokens.refresh_token)
    if (
      !transaction.expectedAccount ||
      previous?.tokens.user_unique_id !== tokens.user_unique_id
    ) {
      await resetPrivilegeMode()
    }
    setCookie(sessionCookie, sessionId, sessionCookieOptions())
    return transaction.returnTo
  } finally {
    if (store.transactions.get(transactionId) === transaction) {
      store.transactions.delete(transactionId)
    }
  }
}

export function hasHubSession() {
  return hubSessionIdentity() !== null
}

export function hubSessionIdentity() {
  if (sharedMode())
    return requestSession.getStore()?.session?.tokens.user_unique_id ?? null
  const sessionId = getCookie(sessionCookie)
  if (!sessionId) return null
  const current = localSession(sessionId, true)
  if (!current) return null
  return current.tokens.user_unique_id
}

function session() {
  const sessionId = getCookie(sessionCookie)
  if (
    !sessionId ||
    (sharedMode()
      ? !requestSession.getStore()?.session
      : !localSession(sessionId))
  ) {
    throw new Error("Sign in to Crucible Hub to continue.")
  }
  return sessionId
}

async function refreshSharedSession(
  sessionId: string,
  previousRefreshToken: string
): Promise<Tokens | null> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const current = await readSession(sessionId)
    if (!current) {
      clearSharedRequestSession()
      return null
    }
    if (current.session.tokens.refresh_token !== previousRefreshToken)
      return current.session.tokens
    if (!refreshClaimed(current.session)) {
      const claimed = await replaceSession(sessionId, current, {
        ...current.session,
        refreshing: true,
        refreshingSince: Date.now(),
      })
      if (!claimed) continue
      try {
        const tokens = await tokenRequest({
          grant_type: "refresh_token",
          refresh_token: current.session.tokens.refresh_token,
        })
        const claimedState = await readSession(sessionId)
        if (!claimedState || !claimedState.session.refreshing) {
          await revokeRefreshToken(tokens.refresh_token)
          clearSharedRequestSession()
          return null
        }
        const updated = {
          ...claimedState.session,
          tokens,
          refreshing: false,
          refreshingSince: undefined,
          refreshRetryAt: undefined,
        }
        if (!(await replaceSession(sessionId, claimedState, updated))) {
          await revokeRefreshToken(tokens.refresh_token)
          clearSharedRequestSession()
          return null
        }
        const context = requestSession.getStore()
        if (context) context.session = updated
        return tokens
      } catch (error) {
        const failure = refreshFailure(error)
        if (failure.transient) {
          const claimedState = await readSession(sessionId)
          if (claimedState?.session.refreshing)
            await replaceSession(sessionId, claimedState, {
              ...claimedState.session,
              refreshing: false,
              refreshingSince: undefined,
              refreshRetryAt: Date.now() + failure.retryAfterMs,
            })
          throw refreshUnavailable(failure.retryAfterMs)
        }
        await closeSession(sessionId)
        clearSharedRequestSession()
        throw error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw refreshUnavailable(refreshClaimLifetime)
}

function sharedSessionApiFetch(sessionId: string): typeof fetch {
  return async (input, init) => {
    const original = new Request(input, init)
    const execute = async (accessToken: string) => {
      const headers = new Headers(original.headers)
      headers.set("Authorization", `Bearer ${accessToken}`)
      return fetch(new Request(original.clone(), { headers }))
    }
    let current = await readSession(sessionId)
    if (!current) {
      clearSharedRequestSession()
      throw new Error("The Hub session has ended.")
    }
    const accessExpiresAt = Date.parse(current.session.tokens.access_expires_at)
    const retryAt = current.session.refreshRetryAt ?? 0
    if (
      refreshClaimed(current.session) ||
      accessExpiresAt <= Date.now() + 30000
    ) {
      if (retryAt > Date.now() && !refreshClaimed(current.session)) {
        if (accessExpiresAt <= Date.now())
          throw refreshUnavailable(retryAt - Date.now())
      } else {
        try {
          const tokens = await refreshSharedSession(
            sessionId,
            current.session.tokens.refresh_token
          )
          if (!tokens) throw new Error("The Hub session has ended.")
        } catch (error) {
          if (!(
            accessExpiresAt > Date.now() &&
            error instanceof CrucibleResponseError
          ))
            throw error
        }
        current = await readSession(sessionId)
        if (!current) {
          clearSharedRequestSession()
          throw new Error("The Hub session has ended.")
        }
      }
    }
    const usedToken = current.session.tokens.access_token
    let response = await execute(usedToken)
    if (response.status === 401 && !isStepUpChallenge(response)) {
      const latest = await readSession(sessionId)
      if (!latest) {
        clearSharedRequestSession()
        throw new Error("The Hub session has ended.")
      }
      const tokens =
        latest.session.tokens.access_token !== usedToken
          ? latest.session.tokens
          : await refreshSharedSession(
              sessionId,
              latest.session.tokens.refresh_token
            )
      if (!tokens) throw new Error("The Hub session has ended.")
      response = await execute(tokens.access_token)
      if (response.status === 401 && !isStepUpChallenge(response)) {
        await closeSession(sessionId)
        clearSharedRequestSession()
      }
    }
    return response
  }
}

async function refresh(sessionId: string): Promise<Tokens | null> {
  const existing = store.refreshes.get(sessionId)
  if (existing) return existing
  const current = localSession(sessionId)
  if (!current) return null
  const operation = tokenRequest({
    grant_type: "refresh_token",
    refresh_token: current.tokens.refresh_token,
  })
    .then(async (tokens) => {
      if (localSession(sessionId) !== current) {
        await revokeRefreshToken(tokens.refresh_token)
        return null
      }
      current.tokens = tokens
      current.refreshRetryAt = undefined
      return tokens
    })
    .catch((error: unknown) => {
      const failure = refreshFailure(error)
      if (failure.transient) {
        current.refreshRetryAt = Date.now() + failure.retryAfterMs
        throw refreshUnavailable(failure.retryAfterMs)
      }
      store.sessions.delete(sessionId)
      if (error instanceof TokenRequestError && error.status < 500) return null
      throw error
    })
    .finally(() => store.refreshes.delete(sessionId))
  store.refreshes.set(sessionId, operation)
  return operation
}

export function sessionApiFetch(): typeof fetch {
  const sessionId = session()
  if (sharedMode()) return sharedSessionApiFetch(sessionId)
  return async (input, init) => {
    const original = new Request(input, init)
    const execute = async (accessToken: string) => {
      const headers = new Headers(original.headers)
      headers.set("Authorization", `Bearer ${accessToken}`)
      return fetch(new Request(original.clone(), { headers }))
    }
    let current = localSession(sessionId)
    if (!current) throw new Error("The Hub session has ended.")
    if (Date.parse(current.tokens.refresh_expires_at) <= Date.now()) {
      store.sessions.delete(sessionId)
      throw new Error("The Hub session has expired.")
    }
    if (Date.parse(current.tokens.access_expires_at) <= Date.now() + 30000) {
      const accessValid =
        Date.parse(current.tokens.access_expires_at) > Date.now()
      const retryAt = current.refreshRetryAt ?? 0
      if (retryAt > Date.now()) {
        if (!accessValid) throw refreshUnavailable(retryAt - Date.now())
      } else {
        try {
          const tokens = await refresh(sessionId)
          if (!tokens) throw new Error("The Hub session has expired.")
        } catch (error) {
          if (!(accessValid && error instanceof CrucibleResponseError))
            throw error
        }
        current = localSession(sessionId)
        if (!current) throw new Error("The Hub session has ended.")
      }
    }
    const usedToken = current.tokens.access_token
    let response = await execute(usedToken)
    if (response.status === 401 && !isStepUpChallenge(response)) {
      const latest = localSession(sessionId)?.tokens
      const tokens =
        latest?.access_token !== usedToken ? latest : await refresh(sessionId)
      if (!tokens) throw new Error("The Hub session has expired.")
      response = await execute(tokens.access_token)
      if (response.status === 401 && !isStepUpChallenge(response)) {
        store.sessions.delete(sessionId)
      }
    }
    return response
  }
}

export function hubSessionId() {
  return session()
}

export function hubSharedSessions() {
  return sharedMode()
}

export async function hubSessionAccessToken() {
  const sessionId = session()
  if (sharedMode()) {
    const current = await readSession(sessionId)
    if (!current) {
      clearSharedRequestSession()
      throw new Error("The Hub session has ended.")
    }
    const { tokens } = current.session
    const accessExpiresAt = Date.parse(tokens.access_expires_at)
    if (accessExpiresAt > Date.now() + 30000) return tokens.access_token
    const retryAt = current.session.refreshRetryAt ?? 0
    if (retryAt > Date.now() && !refreshClaimed(current.session)) {
      if (accessExpiresAt > Date.now()) return tokens.access_token
      throw refreshUnavailable(retryAt - Date.now())
    }
    const refreshed = await refreshSharedSession(
      sessionId,
      tokens.refresh_token
    )
    if (!refreshed) throw new Error("The Hub session has ended.")
    return refreshed.access_token
  }
  const current = localSession(sessionId)
  if (!current) throw new Error("The Hub session has ended.")
  if (Date.parse(current.tokens.refresh_expires_at) <= Date.now())
    throw new Error("The Hub session has expired.")
  const accessExpiresAt = Date.parse(current.tokens.access_expires_at)
  if (accessExpiresAt > Date.now() + 30000) return current.tokens.access_token
  const retryAt = current.refreshRetryAt ?? 0
  if (retryAt > Date.now()) {
    if (accessExpiresAt > Date.now()) return current.tokens.access_token
    throw refreshUnavailable(retryAt - Date.now())
  }
  const refreshed = await refresh(sessionId)
  if (!refreshed) throw new Error("The Hub session has expired.")
  return refreshed.access_token
}

export async function hubClientPost(
  path: string,
  body: object,
  signal?: AbortSignal
) {
  const { baseUrl, secret } = hubAuthConfig()
  const timeout = AbortSignal.timeout(15000)
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: basicAuthorization(secret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
}

export function hubLinkCallbackUri() {
  return `${hubAuthPublicOrigin()}/hub/auth/link/callback`
}

export function hubApiAuthorizationUrl(value: string) {
  const { publicBaseUrl } = hubAuthConfig()
  const url = new URL(value)
  if (
    !url.href.startsWith(`${publicBaseUrl}/`) ||
    url.username ||
    url.password
  ) {
    throw new Error("The API returned an unexpected sign-in address.")
  }
  return url.href
}

async function revokeRefreshToken(refreshToken: string) {
  try {
    const { baseUrl, secret } = hubAuthConfig()
    const response = await fetch(`${baseUrl}/oauth/revoke`, {
      method: "POST",
      headers: {
        Authorization: basicAuthorization(secret),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token: refreshToken,
        token_type_hint: "refresh_token",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function logoutHubSession() {
  const sessionId = getCookie(sessionCookie)
  const transactionId = getCookie(transactionCookie)
  if (sharedMode()) {
    let confirmed = true
    let issued: SharedSession | null = null
    if (transactionId) {
      try {
        issued = await cancelTransaction(transactionId)
      } catch {
        confirmed = false
      }
    }
    deleteCookie(transactionCookie, cookieOptions("/hub/auth"))
    let current: SharedSession | null = null
    if (sessionId) {
      try {
        current = await closeSession(sessionId)
      } catch {
        confirmed = false
      }
    }
    deleteCookie(sessionCookie, cookieOptions("/hub"))
    clearLegacyPrivilegeModeCookie()
    clearSharedRequestSession()
    const refreshTokens = new Set(
      [issued?.tokens.refresh_token, current?.tokens.refresh_token].filter(
        (token): token is string => Boolean(token)
      )
    )
    for (const token of refreshTokens) {
      confirmed = (await revokeRefreshToken(token)) && confirmed
    }
    return confirmed
  }
  if (transactionId) {
    const transaction = store.transactions.get(transactionId)
    if (transaction) transaction.cancelled = true
    store.transactions.delete(transactionId)
  }
  deleteCookie(transactionCookie, cookieOptions("/hub/auth"))
  const refreshToken = sessionId
    ? store.sessions.get(sessionId)?.tokens.refresh_token
    : undefined
  if (sessionId) store.sessions.delete(sessionId)
  deleteCookie(sessionCookie, cookieOptions("/hub"))
  await resetPrivilegeMode()
  return refreshToken ? revokeRefreshToken(refreshToken) : true
}
