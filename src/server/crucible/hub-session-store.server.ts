import "@tanstack/react-start/server-only"

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"

import { z } from "zod"

import type { HubSessionBackend } from "./hub-session-backend.server"
import {
  postgresSessionBackend,
  postgresSessionsConfigured,
  postgresSessionsRequested,
} from "./hub-session-postgres.server"

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  access_expires_at: z.iso.datetime({ offset: true }),
  refresh_expires_at: z.iso.datetime({ offset: true }),
  token_type: z.literal("Bearer"),
  user_unique_id: z.string().min(1),
})

const sessionSchema = z.object({
  tokens: tokenSchema,
  privilegeMode: z.enum(["normal", "elevated"]),
  elevatedAt: z.number().int().optional(),
  expiresAt: z.number().int(),
  idleExpiresAt: z.number().int(),
  refreshing: z.boolean().default(false),
  refreshingSince: z.number().int().optional(),
  refreshRetryAt: z.number().int().optional(),
})

const transactionSchema = z.object({
  state: z.string(),
  verifier: z.string(),
  returnTo: z.string(),
  expiresAt: z.number().int(),
})

export type SharedSession = z.infer<typeof sessionSchema>
export type SharedTransaction = z.infer<typeof transactionSchema>
export type StoredSession = { raw: string; session: SharedSession }
export type SharedSessionStoreKind = "postgres"

const prefix = "crucible:hub:v1:"
const absoluteLifetime = 30 * 24 * 60 * 60 * 1000
const idleLifetime = 7 * 24 * 60 * 60 * 1000
const elevatedLifetime = 12 * 60 * 60 * 1000
const issuedLifetime = 10 * 60 * 1000

function configuration() {
  const value = process.env.HUB_SESSION_KEYS
  if (!value || !sharedSessionStoreKind())
    throw new Error("Shared Hub sessions are not configured.")
  const keys = value.split(",").map((entry) => {
    const separator = entry.indexOf(":")
    const id = entry.slice(0, separator)
    const secretKey = Buffer.from(entry.slice(separator + 1), "base64url")
    if (
      !/^[a-zA-Z0-9_-]{1,16}$/.test(id) ||
      secretKey.length !== 32 ||
      secretKey.toString("base64url") !== entry.slice(separator + 1)
    ) {
      throw new Error("Shared Hub session keys are invalid.")
    }
    return { id, key: secretKey }
  })
  if (new Set(keys.map(({ id }) => id)).size !== keys.length) {
    throw new Error("Shared Hub session key IDs must be unique.")
  }
  return { keys }
}

export function sharedSessionStoreKind(): SharedSessionStoreKind | null {
  return postgresSessionsRequested() ? "postgres" : null
}

export function sharedSessionsConfigured() {
  const kind = sharedSessionStoreKind()
  if (!kind || !process.env.HUB_SESSION_KEYS) return false
  return postgresSessionsConfigured()
}

export function sharedSessionsRequested() {
  return Boolean(sharedSessionStoreKind() || process.env.HUB_SESSION_KEYS)
}

function backend(): HubSessionBackend {
  return postgresSessionBackend
}

function key(kind: string, id: string) {
  return `${prefix}${kind}:${createHash("sha256").update(id).digest("hex")}`
}

function seal(value: SharedSession | SharedTransaction, storageKey: string) {
  const current = configuration().keys[0]
  const nonce = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", current.key, nonce)
  cipher.setAAD(Buffer.from(storageKey))
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ])
  return [
    current.id,
    nonce.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    payload.toString("base64url"),
  ].join(".")
}

function open(raw: string, storageKey: string) {
  const [id, nonce, tag, payload] = raw.split(".")
  const selected = configuration().keys.find((candidate) => candidate.id === id)
  if (!selected || !nonce || !tag || !payload)
    throw new Error("Hub session state is unavailable.")
  const decipher = createDecipheriv(
    "aes-256-gcm",
    selected.key,
    Buffer.from(nonce, "base64url")
  )
  decipher.setAAD(Buffer.from(storageKey))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(payload, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  ) as unknown
}

function lifetime(expiresAt: number) {
  return Math.max(1, expiresAt - Date.now())
}

function sessionLifetime(session: SharedSession) {
  return lifetime(Math.min(session.expiresAt, session.idleExpiresAt))
}

export function sessionPrivilegeMode(session: SharedSession) {
  return session.privilegeMode === "elevated" &&
    session.elevatedAt !== undefined &&
    session.elevatedAt + elevatedLifetime > Date.now()
    ? "elevated"
    : "normal"
}

export function newSharedSession(
  tokens: SharedSession["tokens"]
): SharedSession {
  return {
    tokens,
    privilegeMode: "normal",
    expiresAt: Math.min(
      Date.now() + absoluteLifetime,
      Date.parse(tokens.refresh_expires_at)
    ),
    idleExpiresAt: Date.now() + idleLifetime,
    refreshing: false,
  }
}

export async function saveTransaction(
  id: string,
  transaction: SharedTransaction
) {
  const storageKey = key("transaction", id)
  await backend().set(
    storageKey,
    seal(transaction, storageKey),
    lifetime(transaction.expiresAt)
  )
}

export async function consumeTransaction(id: string) {
  const storageKey = key("transaction", id)
  const raw = await backend().take(storageKey)
  return raw ? transactionSchema.parse(open(raw, storageKey)) : null
}

export async function cancelTransaction(id: string) {
  const store = backend()
  await store.cancelLogin(
    key("cancel", id),
    key("transaction", id),
    issuedLifetime
  )
  const issued = await store.take(key("issued", id))
  if (!issued) return null
  const raw = await store.take(issued)
  return raw ? sessionSchema.parse(open(raw, issued)) : null
}

export async function createSessionAfterCallback(
  id: string,
  sessionId: string,
  previousId: string | null,
  session: SharedSession
) {
  const sessionKey = key("session", sessionId)
  return backend().issueAfterLogin({
    cancelKey: key("cancel", id),
    sessionKey,
    previousKey: key("session", previousId ?? sessionId),
    issuedKey: key("issued", id),
    value: seal(session, sessionKey),
    lifetimeMs: sessionLifetime(session),
    issuedLifetimeMs: issuedLifetime,
  })
}

export async function readSession(id: string): Promise<StoredSession | null> {
  const storageKey = key("session", id)
  const raw = await backend().get(storageKey)
  if (!raw) return null
  const session = sessionSchema.parse(open(raw, storageKey))
  if (
    session.expiresAt <= Date.now() ||
    session.idleExpiresAt <= Date.now() ||
    Date.parse(session.tokens.refresh_expires_at) <= Date.now()
  ) {
    await closeSession(id)
    return null
  }
  return { raw, session }
}

export async function replaceSession(
  id: string,
  previous: StoredSession,
  session: SharedSession
) {
  const storageKey = key("session", id)
  return backend().compareAndSet(
    storageKey,
    previous.raw,
    seal(session, storageKey),
    sessionLifetime(session)
  )
}

export async function touchSession(id: string, previous: StoredSession) {
  if (
    previous.session.idleExpiresAt - Date.now() >
    idleLifetime - 60 * 60 * 1000
  ) {
    return previous.session
  }
  const updated = {
    ...previous.session,
    idleExpiresAt: Date.now() + idleLifetime,
  }
  return (await replaceSession(id, previous, updated))
    ? updated
    : ((await readSession(id))?.session ?? null)
}

export async function rotateSession(
  id: string,
  nextId: string,
  previous: StoredSession,
  session: SharedSession
) {
  const nextKey = key("session", nextId)
  return backend().move(
    key("session", id),
    nextKey,
    previous.raw,
    seal(session, nextKey),
    sessionLifetime(session)
  )
}

export async function closeSession(id: string) {
  const storageKey = key("session", id)
  const raw = await backend().take(storageKey)
  return raw ? sessionSchema.parse(open(raw, storageKey)) : null
}
