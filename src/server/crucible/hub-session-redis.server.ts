import "@tanstack/react-start/server-only"

import { createClient } from "redis"

import type { HubSessionBackend } from "./hub-session-backend.server"

const compareAndSetScript = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1
`
const takeScript = `
local old = redis.call('GET', KEYS[1])
redis.call('DEL', KEYS[1])
return old
`
const issueAfterLoginScript = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('SET', KEYS[2], ARGV[1], 'PX', ARGV[2])
if KEYS[3] ~= KEYS[2] then redis.call('DEL', KEYS[3]) end
redis.call('SET', KEYS[4], KEYS[2], 'PX', ARGV[3])
return 1
`
const cancelLoginScript = `
redis.call('SET', KEYS[1], '1', 'PX', ARGV[1])
redis.call('DEL', KEYS[2])
return 1
`
const moveScript = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])
redis.call('DEL', KEYS[1])
return 1
`

export function redisSessionUrl() {
  const url = process.env.HUB_SESSION_REDIS_URL
  if (!url) throw new Error("Shared Hub sessions are not configured.")
  const parsed = new URL(url)
  if (
    parsed.protocol !== "rediss:" &&
    !(process.env.NODE_ENV !== "production" && parsed.protocol === "redis:")
  ) {
    throw new Error("Shared Hub sessions require a trusted Redis connection.")
  }
  return url
}

function createSessionRedisClient() {
  return createClient({
    url: redisSessionUrl(),
    socket: { connectTimeout: 5000, reconnectStrategy: false },
  })
}

type SessionRedisClient = ReturnType<typeof createSessionRedisClient>
let connection: SessionRedisClient | undefined
let connecting: Promise<SessionRedisClient> | undefined

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

export const redisSessionBackend: HubSessionBackend = {
  async set(key, value, lifetimeMs) {
    await (await redis()).set(key, value, { PX: lifetimeMs })
  },
  async get(key) {
    return (await redis()).get(key)
  },
  async take(key) {
    const raw = await (
      await redis()
    ).eval(takeScript, { keys: [key], arguments: [] })
    return typeof raw === "string" ? raw : null
  },
  async compareAndSet(key, expected, value, lifetimeMs) {
    const result = await (
      await redis()
    ).eval(compareAndSetScript, {
      keys: [key],
      arguments: [expected, value, String(lifetimeMs)],
    })
    return result === 1
  },
  async move(key, nextKey, expected, value, lifetimeMs) {
    const result = await (
      await redis()
    ).eval(moveScript, {
      keys: [key, nextKey],
      arguments: [expected, value, String(lifetimeMs)],
    })
    return result === 1
  },
  async cancelLogin(cancelKey, transactionKey, lifetimeMs) {
    await (
      await redis()
    ).eval(cancelLoginScript, {
      keys: [cancelKey, transactionKey],
      arguments: [String(lifetimeMs)],
    })
  },
  async issueAfterLogin(input) {
    const result = await (
      await redis()
    ).eval(issueAfterLoginScript, {
      keys: [
        input.cancelKey,
        input.sessionKey,
        input.previousKey,
        input.issuedKey,
      ],
      arguments: [
        input.value,
        String(input.lifetimeMs),
        String(input.issuedLifetimeMs),
      ],
    })
    return result === 1
  },
}
