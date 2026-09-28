import "@tanstack/react-start/server-only"

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"

import { createClient } from "redis"
import { z } from "zod"

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
  expiresAt: z.number().int(),
  idleExpiresAt: z.number().int(),
  refreshing: z.boolean().default(false),
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

const prefix = "crucible:hub:v1:"
const absoluteLifetime = 12 * 60 * 60 * 1000
const idleLifetime = 8 * 60 * 60 * 1000
const compareAndSetScript = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1
`
const closeScript = `
local old = redis.call('GET', KEYS[1])
redis.call('DEL', KEYS[1])
return old
`
const createAfterCallbackScript = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('SET', KEYS[2], ARGV[1], 'PX', ARGV[2])
if KEYS[3] ~= KEYS[2] then redis.call('DEL', KEYS[3]) end
redis.call('SET', KEYS[4], KEYS[2], 'PX', ARGV[3])
return 1
`
const cancelTransactionScript = `
redis.call('SET', KEYS[1], '1', 'PX', ARGV[1])
redis.call('DEL', KEYS[2])
return 1
`
const rotateSessionScript = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])
redis.call('DEL', KEYS[1])
return 1
`

function createSessionRedisClient() {
  return createClient({
    url: configuration().url,
    socket: { connectTimeout: 5000, reconnectStrategy: false },
  })
}

type SessionRedisClient = ReturnType<typeof createSessionRedisClient>
let connection: SessionRedisClient | undefined
let connecting: Promise<SessionRedisClient> | undefined

function configuration() {
  const url = process.env.HUB_SESSION_REDIS_URL
  const value = process.env.HUB_SESSION_KEYS
  if (!url || !value) throw new Error("Shared Hub sessions are not configured.")
  const parsed = new URL(url)
  if (
    parsed.protocol !== "rediss:" &&
    !(process.env.NODE_ENV !== "production" && parsed.protocol === "redis:")
  ) {
    throw new Error("Shared Hub sessions require a trusted Redis connection.")
  }
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
  return { url, keys }
}

export function sharedSessionsConfigured() {
  return Boolean(
    process.env.HUB_SESSION_REDIS_URL && process.env.HUB_SESSION_KEYS
  )
}

export function sharedSessionsRequested() {
  return Boolean(
    process.env.HUB_SESSION_REDIS_URL || process.env.HUB_SESSION_KEYS
  )
}

async function redis() {
  if (connection?.isReady) return connection
  if (connection?.isOpen) throw new Error("Hub session storage is unavailable.")
  if (connection) {
    connection = undefined
    connecting = undefined
  }
  if (connecting) return connecting
  const client = createSessionRedisClient()
  client.on("error", () => {})
  connecting = client
    .connect()
    .then(() => {
      connection = client
      return client
    })
    .catch((error: unknown) => {
      connecting = undefined
      throw error
    })
  return connecting
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
  await (
    await redis()
  ).set(storageKey, seal(transaction, storageKey), {
    PX: lifetime(transaction.expiresAt),
  })
}

export async function consumeTransaction(id: string) {
  const storageKey = key("transaction", id)
  const raw = await (await redis()).getDel(storageKey)
  return raw ? transactionSchema.parse(open(raw, storageKey)) : null
}

export async function cancelTransaction(id: string) {
  const client = await redis()
  await client.eval(cancelTransactionScript, {
    keys: [key("cancel", id), key("transaction", id)],
    arguments: [String(10 * 60 * 1000)],
  })
  const issued = await client.getDel(key("issued", id))
  if (!issued) return null
  const raw = await client.getDel(issued)
  return raw ? sessionSchema.parse(open(raw, issued)) : null
}

export async function createSessionAfterCallback(
  id: string,
  sessionId: string,
  previousId: string | null,
  session: SharedSession
) {
  const sessionKey = key("session", sessionId)
  const result = await (
    await redis()
  ).eval(createAfterCallbackScript, {
    keys: [
      key("cancel", id),
      sessionKey,
      key("session", previousId ?? sessionId),
      key("issued", id),
    ],
    arguments: [
      seal(session, sessionKey),
      String(sessionLifetime(session)),
      String(10 * 60 * 1000),
    ],
  })
  return result === 1
}

export async function readSession(id: string): Promise<StoredSession | null> {
  const storageKey = key("session", id)
  const raw = await (await redis()).get(storageKey)
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
  const result = await (
    await redis()
  ).eval(compareAndSetScript, {
    keys: [storageKey],
    arguments: [
      previous.raw,
      seal(session, storageKey),
      String(sessionLifetime(session)),
    ],
  })
  return result === 1
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
  const result = await (
    await redis()
  ).eval(rotateSessionScript, {
    keys: [key("session", id), nextKey],
    arguments: [
      previous.raw,
      seal(session, nextKey),
      String(sessionLifetime(session)),
    ],
  })
  return result === 1
}

export async function closeSession(id: string) {
  const storageKey = key("session", id)
  const raw = await (
    await redis()
  ).eval(closeScript, { keys: [storageKey], arguments: [] })
  return typeof raw === "string"
    ? sessionSchema.parse(open(raw, storageKey))
    : null
}
