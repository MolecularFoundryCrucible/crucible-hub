import "@tanstack/react-start/server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { AsyncLocalStorage } from "node:async_hooks"

import {
  deleteCookie,
  getCookie,
  getRequest,
  getRequestIP,
  setCookie,
} from "@tanstack/react-start/server"
import { z } from "zod"

import {
  clearLegacyPrivilegeModeCookie,
  writeGlobalPrivilegeMode,
} from "./privilege-mode.server"
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

const clientId = "crucible-hub"
const localCallbackUri = "http://127.0.0.1:3000/hub/auth/callback"
const sessionCookie = "crucible_hub_session"
const transactionCookie = "crucible_hub_login"
const transactionLifetime = 10 * 60 * 1000
const sessionIdleLifetime = 8 * 60 * 60 * 1000
const sessionAbsoluteLifetime = 12 * 60 * 60 * 1000

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  access_expires_at: z.iso.datetime({ offset: true }),
  refresh_expires_at: z.iso.datetime({ offset: true }),
  token_type: z.literal("Bearer").default("Bearer"),
  user_unique_id: z.string().min(1),
})

type Tokens = z.infer<typeof tokenSchema>
type Transaction = {
  state: string
  verifier: string
  returnTo: string
  expiresAt: number
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

class TokenRequestError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterSeconds?: number
  ) {
    super("The Crucible sign-in request failed.")
  }
}

const transientRefreshDelay = 5000

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

export function hubSignInFailureDetails(error: unknown) {
  if (error instanceof TokenRequestError) {
    return { reason: "token-exchange-rejected", status: error.status }
  }
  if (error instanceof z.ZodError) {
    return { reason: "invalid-token-response" }
  }
  if (error instanceof Error) {
    const knownReasons: Record<string, string> = {
      "Invalid sign-in response.": "invalid-callback-response",
      "The sign-in request has expired.": "expired-transaction",
      "The sign-in request could not be verified.": "state-mismatch",
      "Hub sign-in is not configured.": "configuration",
      "Hub sign-in callback is not configured correctly.": "configuration",
      "Hub API URL must be a trusted HTTPS URL.": "configuration",
    }
    return {
      reason:
        knownReasons[error.message] ??
        (error.name === "TypeError" ? "api-connection" : "unexpected"),
    }
  }
  return { reason: "unexpected" }
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

export class HubLoginRateLimitError extends Error {
  constructor() {
    super("Too many sign-in requests. Try again shortly.")
    this.name = "HubLoginRateLimitError"
  }
}

export function enforceHubLoginRateLimit() {
  const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown"
  const now = Date.now()
  if (loginAttempts.size >= maxTrackedLoginClients) {
    for (const [client, timestamps] of loginAttempts) {
      if (timestamps.every((timestamp) => now - timestamp >= loginRateWindow)) {
        loginAttempts.delete(client)
      }
    }
  }
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

export function productionHubAuthReady() {
  if (process.env.NODE_ENV !== "production") return true
  if (process.env.HUB_AUTH_PRODUCTION_ENABLED !== "true") return false
  if (process.env.HUB_AUTH_SESSION_MODE === "redis")
    return sharedSessionsConfigured()
  if (process.env.HUB_AUTH_SESSION_MODE === "single-instance")
    return !sharedSessionsRequested()
  return false
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
  const path = new URL(getRequest().url).pathname
  if (path.startsWith("/hub/auth/") || path === "/hub/health") {
    return await next()
  }
  const id = getCookie(sessionCookie)
  const current = id ? await readSession(id) : null
  const activeSession = id && current ? await touchSession(id, current) : null
  return await requestSession.run({ session: activeSession }, next)
}

export function sharedRequestPrivilegeMode() {
  return sharedMode()
    ? (requestSession.getStore()?.session?.privilegeMode ?? "normal")
    : null
}

export async function updateSharedPrivilegeMode(mode: "normal" | "elevated") {
  if (!sharedMode()) return false
  const id = getCookie(sessionCookie)
  if (!id) throw new Error("Sign in to Crucible Hub to continue.")
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readSession(id)
    if (!current) throw new Error("The Hub session has ended.")
    if (current.session.refreshing)
      throw new Error("The Hub session is refreshing. Try again.")
    const updated = { ...current.session, privilegeMode: mode }
    const nextId = randomValue()
    if (await rotateSession(id, nextId, current, updated)) {
      setCookie(sessionCookie, nextId, cookieOptions("/hub"))
      const context = requestSession.getStore()
      if (context) context.session = updated
      return true
    }
  }
  throw new Error("The Hub session changed. Try again.")
}

function randomValue() {
  return randomBytes(32).toString("base64url")
}

const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"])

function configuredCallbackUri() {
  const value = process.env.HUB_AUTH_CALLBACK_URI ?? localCallbackUri
  const url = new URL(value)
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && loopbackHosts.has(url.hostname))) ||
    url.pathname !== "/hub/auth/callback" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("Hub sign-in callback is not configured correctly.")
  }
  return url.toString()
}

export function hubAuthPublicOrigin() {
  return new URL(configuredCallbackUri()).origin
}

function httpsApiUrl(value: string) {
  const url = new URL(value)
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Hub API URL must be a trusted HTTPS URL.")
  }
  return url.toString().replace(/\/$/, "")
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

function cookieOptions(path: string) {
  return {
    httpOnly: true,
    path,
    sameSite: "lax" as const,
    secure: new URL(configuredCallbackUri()).protocol === "https:",
  }
}

function config() {
  const baseUrl = process.env.CRUCIBLE_API_BASE_URL
  const publicBaseUrl = process.env.HUB_AUTH_PUBLIC_API_URL ?? baseUrl
  const secret = process.env.HUB_AUTH_CLIENT_SECRET
  const callbackUri = configuredCallbackUri()
  if (
    process.env.HUB_DATA_SOURCE !== "hub-auth" ||
    !productionHubAuthReady() ||
    !baseUrl ||
    !publicBaseUrl ||
    !secret ||
    (process.env.NODE_ENV === "production" &&
      new URL(callbackUri).protocol !== "https:")
  ) {
    throw new Error("Hub sign-in is not configured.")
  }
  return {
    baseUrl: httpsApiUrl(baseUrl),
    publicBaseUrl: httpsApiUrl(publicBaseUrl),
    callbackUri,
    secret,
  }
}

function basicAuthorization(secret: string) {
  return `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`
}

async function tokenRequest(path: string, body: object): Promise<Tokens> {
  const { baseUrl, secret } = config()
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: basicAuthorization(secret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok)
    throw new TokenRequestError(
      response.status,
      readRetryAfterSeconds(response.headers)
    )
  return tokenSchema.parse(await response.json())
}

export async function beginHubLogin(
  returnTo: string | null,
  maxAge: number | null = null
) {
  const { publicBaseUrl, callbackUri } = config()
  if (!sharedMode()) {
    for (const [id, transaction] of store.transactions) {
      if (transaction.expiresAt < Date.now()) store.transactions.delete(id)
    }
    for (const id of store.sessions.keys()) localSession(id)
  }
  const state = randomValue()
  const verifier = randomValue()
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  const transactionId = randomValue()
  const transaction = {
    state,
    verifier,
    returnTo: safeReturnTo(returnTo),
    expiresAt: Date.now() + transactionLifetime,
    consumed: false,
    cancelled: false,
  }
  if (sharedMode()) await saveTransaction(transactionId, transaction)
  else store.transactions.set(transactionId, transaction)
  setCookie(transactionCookie, transactionId, {
    ...cookieOptions("/hub/auth"),
    maxAge: transactionLifetime / 1000,
  })
  const url = new URL(`${publicBaseUrl}/auth/hub/login`)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", callbackUri)
  url.searchParams.set("state", state)
  url.searchParams.set("code_challenge", challenge)
  url.searchParams.set("code_challenge_method", "S256")
  if (maxAge !== null) url.searchParams.set("max_age", String(maxAge))
  return url.toString()
}

export async function finishHubLogin(code: string, state: string) {
  const { callbackUri } = config()
  const transactionId = getCookie(transactionCookie)
  deleteCookie(transactionCookie, cookieOptions("/hub/auth"))
  if (!transactionId) throw new Error("The sign-in request has expired.")
  if (sharedMode()) {
    const transaction = await consumeTransaction(transactionId)
    if (!transaction || transaction.expiresAt < Date.now()) {
      throw new Error("The sign-in request has expired.")
    }
    const expected = Buffer.from(transaction.state)
    const actual = Buffer.from(state)
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new Error("The sign-in request could not be verified.")
    }
    const tokens = await tokenRequest("/auth/hub/token", {
      code,
      code_verifier: transaction.verifier,
      redirect_uri: callbackUri,
    })
    const sessionId = randomValue()
    let accepted: boolean
    try {
      accepted = await createSessionAfterCallback(
        transactionId,
        sessionId,
        getCookie(sessionCookie) ?? null,
        newSharedSession(tokens)
      )
    } catch (error) {
      await revokeRefreshToken(tokens.refresh_token)
      throw error
    }
    if (!accepted) {
      await revokeRefreshToken(tokens.refresh_token)
      throw new Error("The sign-in request has expired.")
    }
    clearLegacyPrivilegeModeCookie()
    setCookie(sessionCookie, sessionId, cookieOptions("/hub"))
    return transaction.returnTo
  }
  const transaction = store.transactions.get(transactionId)
  if (
    !transaction ||
    transaction.expiresAt < Date.now() ||
    transaction.consumed ||
    transaction.cancelled
  ) {
    throw new Error("The sign-in request has expired.")
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
    const tokens = await tokenRequest("/auth/hub/token", {
      code,
      code_verifier: transaction.verifier,
      redirect_uri: callbackUri,
    })
    if (
      transaction.cancelled ||
      store.transactions.get(transactionId) !== transaction
    ) {
      await revokeRefreshToken(tokens.refresh_token)
      throw new Error("The sign-in request has expired.")
    }
    const previous = getCookie(sessionCookie)
    if (previous) store.sessions.delete(previous)
    const sessionId = randomValue()
    const now = Date.now()
    store.sessions.set(sessionId, {
      tokens,
      expiresAt: now + sessionAbsoluteLifetime,
      idleExpiresAt: now + sessionIdleLifetime,
    })
    await writeGlobalPrivilegeMode("normal")
    setCookie(sessionCookie, sessionId, cookieOptions("/hub"))
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
  for (let attempt = 0; attempt < 90; attempt++) {
    const current = await readSession(sessionId)
    if (!current) {
      clearSharedRequestSession()
      return null
    }
    if (current.session.tokens.refresh_token !== previousRefreshToken)
      return current.session.tokens
    if (!current.session.refreshing) {
      const claimed = await replaceSession(sessionId, current, {
        ...current.session,
        refreshing: true,
      })
      if (!claimed) continue
      try {
        const tokens = await tokenRequest("/auth/hub/refresh", {
          refresh_token: current.session.tokens.refresh_token,
        })
        const claimedState = await readSession(sessionId)
        if (!claimedState || !claimedState.session.refreshing) {
          await revokeRefreshToken(tokens.refresh_token)
          clearSharedRequestSession()
          return null
        }
        const updated = { ...claimedState.session, tokens, refreshing: false }
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
  await closeSession(sessionId)
  clearSharedRequestSession()
  throw new Error(
    "The Hub session refresh could not be confirmed. Sign in again."
  )
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
    if (
      current.session.refreshing ||
      Date.parse(current.session.tokens.access_expires_at) <= Date.now() + 30000
    ) {
      const tokens = await refreshSharedSession(
        sessionId,
        current.session.tokens.refresh_token
      )
      if (!tokens) throw new Error("The Hub session has ended.")
      current = await readSession(sessionId)
      if (!current) {
        clearSharedRequestSession()
        throw new Error("The Hub session has ended.")
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
  const operation = tokenRequest("/auth/hub/refresh", {
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

async function revokeRefreshToken(refreshToken: string) {
  try {
    const { baseUrl, secret } = config()
    const response = await fetch(`${baseUrl}/auth/hub/revoke`, {
      method: "POST",
      headers: {
        Authorization: basicAuthorization(secret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: refreshToken }),
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
  await writeGlobalPrivilegeMode("normal")
  return refreshToken ? revokeRefreshToken(refreshToken) : true
}
