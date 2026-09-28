import "@tanstack/react-start/server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server"
import { z } from "zod"

import { writeGlobalPrivilegeMode } from "./privilege-mode.server"

const clientId = "crucible-hub"
const localCallbackUri = "http://127.0.0.1:3000/hub/auth/callback"
const sessionCookie = "crucible_hub_session"
const transactionCookie = "crucible_hub_login"
const transactionLifetime = 10 * 60 * 1000

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
}
type Session = { tokens: Tokens }
type Store = {
  transactions: Map<string, Transaction>
  sessions: Map<string, Session>
  refreshes: Map<string, Promise<Tokens | null>>
}

class TokenRequestError extends Error {
  constructor(readonly status: number) {
    super("The Crucible sign-in request failed.")
  }
}

const storeKey = Symbol.for("crucible.hub.auth.local-store")
const globals = globalThis as typeof globalThis & { [storeKey]?: Store }
const store = (globals[storeKey] ??= {
  transactions: new Map(),
  sessions: new Map(),
  refreshes: new Map(),
})

function randomValue() {
  return randomBytes(32).toString("base64url")
}

function configuredCallbackUri() {
  const value = process.env.HUB_AUTH_CALLBACK_URI ?? localCallbackUri
  const url = new URL(value)
  if (
    (url.protocol !== "https:" && value !== localCallbackUri) ||
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
  if (
    process.env.HUB_DATA_SOURCE !== "hub-auth" ||
    process.env.NODE_ENV === "production" ||
    !baseUrl ||
    !publicBaseUrl ||
    !secret
  ) {
    throw new Error("Hub sign-in is not configured for local development.")
  }
  return {
    baseUrl: httpsApiUrl(baseUrl),
    publicBaseUrl: httpsApiUrl(publicBaseUrl),
    callbackUri: configuredCallbackUri(),
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
  if (!response.ok) throw new TokenRequestError(response.status)
  return tokenSchema.parse(await response.json())
}

export function beginHubLogin(returnTo: string | null) {
  const { publicBaseUrl, callbackUri } = config()
  for (const [id, transaction] of store.transactions) {
    if (transaction.expiresAt < Date.now()) store.transactions.delete(id)
  }
  for (const [id, current] of store.sessions) {
    if (Date.parse(current.tokens.refresh_expires_at) < Date.now()) {
      store.sessions.delete(id)
    }
  }
  const state = randomValue()
  const verifier = randomValue()
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  const transactionId = randomValue()
  store.transactions.set(transactionId, {
    state,
    verifier,
    returnTo: safeReturnTo(returnTo),
    expiresAt: Date.now() + transactionLifetime,
  })
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
  return url.toString()
}

export async function finishHubLogin(code: string, state: string) {
  const { callbackUri } = config()
  const transactionId = getCookie(transactionCookie)
  deleteCookie(transactionCookie, cookieOptions("/hub/auth"))
  if (!transactionId) throw new Error("The sign-in request has expired.")
  const transaction = store.transactions.get(transactionId)
  store.transactions.delete(transactionId)
  if (!transaction || transaction.expiresAt < Date.now()) {
    throw new Error("The sign-in request has expired.")
  }
  const expected = Buffer.from(transaction.state)
  const actual = Buffer.from(state)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("The sign-in request could not be verified.")
  }
  const tokens = await tokenRequest("/auth/hub/token", {
    code,
    code_verifier: transaction.verifier,
    redirect_uri: callbackUri,
  })
  const previous = getCookie(sessionCookie)
  if (previous) store.sessions.delete(previous)
  const sessionId = randomValue()
  store.sessions.set(sessionId, { tokens })
  writeGlobalPrivilegeMode("normal")
  setCookie(sessionCookie, sessionId, cookieOptions("/hub"))
  return transaction.returnTo
}

export function hasHubSession() {
  const sessionId = getCookie(sessionCookie)
  if (!sessionId) return false
  const current = store.sessions.get(sessionId)
  if (!current) return false
  if (Date.parse(current.tokens.refresh_expires_at) <= Date.now()) {
    store.sessions.delete(sessionId)
    return false
  }
  return true
}

function session() {
  const sessionId = getCookie(sessionCookie)
  if (!sessionId || !store.sessions.has(sessionId)) {
    throw new Error("Sign in to Crucible Hub to continue.")
  }
  return sessionId
}

async function refresh(sessionId: string): Promise<Tokens | null> {
  const existing = store.refreshes.get(sessionId)
  if (existing) return existing
  const current = store.sessions.get(sessionId)
  if (!current) return null
  const operation = tokenRequest("/auth/hub/refresh", {
    refresh_token: current.tokens.refresh_token,
  })
    .then((tokens) => {
      if (store.sessions.get(sessionId) !== current) return null
      current.tokens = tokens
      return tokens
    })
    .catch((error: unknown) => {
      if (error instanceof TokenRequestError && error.status === 401) {
        store.sessions.delete(sessionId)
        return null
      }
      throw error
    })
    .finally(() => store.refreshes.delete(sessionId))
  store.refreshes.set(sessionId, operation)
  return operation
}

export function sessionApiFetch(): typeof fetch {
  const sessionId = session()
  return async (input, init) => {
    const original = new Request(input, init)
    const execute = async (accessToken: string) => {
      const headers = new Headers(original.headers)
      headers.set("Authorization", `Bearer ${accessToken}`)
      return fetch(new Request(original.clone(), { headers }))
    }
    let current = store.sessions.get(sessionId)
    if (!current) throw new Error("The Hub session has ended.")
    if (Date.parse(current.tokens.refresh_expires_at) <= Date.now()) {
      store.sessions.delete(sessionId)
      throw new Error("The Hub session has expired.")
    }
    if (Date.parse(current.tokens.access_expires_at) <= Date.now() + 30000) {
      const tokens = await refresh(sessionId)
      if (!tokens) throw new Error("The Hub session has expired.")
      current = store.sessions.get(sessionId)
      if (!current) throw new Error("The Hub session has ended.")
    }
    const usedToken = current.tokens.access_token
    let response = await execute(usedToken)
    if (response.status === 401) {
      const latest = store.sessions.get(sessionId)?.tokens
      const tokens =
        latest?.access_token !== usedToken ? latest : await refresh(sessionId)
      if (!tokens) throw new Error("The Hub session has expired.")
      response = await execute(tokens.access_token)
      if (response.status === 401) store.sessions.delete(sessionId)
    }
    return response
  }
}

export async function logoutHubSession() {
  const sessionId = getCookie(sessionCookie)
  deleteCookie(sessionCookie, cookieOptions("/hub"))
  writeGlobalPrivilegeMode("normal")
  if (!sessionId) return
  try {
    await store.refreshes.get(sessionId)
  } catch {
    store.sessions.delete(sessionId)
    throw new Error(
      "Signed out locally, but API revocation could not be confirmed."
    )
  }
  const current = store.sessions.get(sessionId)
  store.sessions.delete(sessionId)
  if (!current) return
  const { baseUrl, secret } = config()
  try {
    const response = await fetch(`${baseUrl}/auth/hub/revoke`, {
      method: "POST",
      headers: {
        Authorization: basicAuthorization(secret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: current.tokens.refresh_token }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error("API revocation failed.")
  } catch {
    throw new Error(
      "Signed out locally, but API revocation could not be confirmed."
    )
  }
}
