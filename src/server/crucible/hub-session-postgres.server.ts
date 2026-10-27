import "@tanstack/react-start/server-only"

import { Pool } from "pg"
import type { PoolClient, PoolConfig } from "pg"

import type { HubSessionBackend } from "./hub-session-backend.server"
import { readSecretSetting } from "./deployment-settings.server"

const expiry = "now() + make_interval(secs => $3::double precision / 1000)"
const cleanupInterval = 15 * 60 * 1000

export function postgresSessionsRequested() {
  return Boolean(
    readSecretSetting("HUB_SESSION_DATABASE_URL") ||
    process.env.HUB_SESSION_DATABASE_INSTANCE
  )
}

export function postgresSessionsConfigured() {
  if (process.env.HUB_SESSION_DATABASE_INSTANCE) {
    return Boolean(readSecretSetting("HUB_SESSION_DATABASE_PASSWORD"))
  }
  return Boolean(readSecretSetting("HUB_SESSION_DATABASE_URL"))
}

/** The session database URL, with the password setting filled in if the URL has none. */
export function sessionDatabaseUrl() {
  const value = readSecretSetting("HUB_SESSION_DATABASE_URL")
  if (!value) return undefined
  const password = readSecretSetting("HUB_SESSION_DATABASE_PASSWORD")
  const url = new URL(value)
  if (password && !url.password) url.password = encodeURIComponent(password)
  return url.toString()
}

const poolSettings: PoolConfig = {
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 5000,
  query_timeout: 6000,
}

async function createPool() {
  const instance = process.env.HUB_SESSION_DATABASE_INSTANCE
  if (instance) {
    const password = readSecretSetting("HUB_SESSION_DATABASE_PASSWORD")
    if (!password) throw new Error("Shared Hub sessions are not configured.")
    const { AuthTypes, Connector, IpAddressTypes } =
      await import("@google-cloud/cloud-sql-connector")
    const connector = new Connector()
    const options = await connector.getOptions({
      instanceConnectionName: instance,
      ipType: IpAddressTypes.PUBLIC,
      authType: AuthTypes.PASSWORD,
    })
    return new Pool({
      ...options,
      ...poolSettings,
      database: process.env.HUB_SESSION_DATABASE_NAME ?? "crucible_hub",
      user: process.env.HUB_SESSION_DATABASE_USER ?? "crucible_hub_app",
      password,
    })
  }
  const url = sessionDatabaseUrl()
  if (!url) throw new Error("Shared Hub sessions are not configured.")
  return new Pool({ ...poolSettings, connectionString: url })
}

let pool: Promise<Pool> | undefined
let lastCleanup = 0

function database() {
  pool ??= createPool().then((created) => {
    created.on("error", () => {})
    return created
  })
  pool.catch(() => {
    pool = undefined
  })
  return pool
}

export async function closePostgresSessionPool() {
  const current = pool
  pool = undefined
  if (current) await (await current).end()
}

/** Whether the session table is reachable with the Hub's own credentials. */
export async function checkPostgresSessionStore() {
  await query("select 1 from hub.session_entries limit 1", [])
}

async function query(text: string, values: unknown[]) {
  return (await database()).query(text, values)
}

async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await (await database()).connect()
  try {
    await client.query("begin")
    const result = await work(client)
    await client.query("commit")
    return result
  } catch (error) {
    await client.query("rollback").catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

function removeExpiredEntries() {
  if (Date.now() - lastCleanup < cleanupInterval) return
  lastCleanup = Date.now()
  query(
    "delete from hub.session_entries where expires_at < now() - interval '1 hour'",
    []
  ).catch(() => undefined)
}

async function upsert(
  run: (text: string, values: unknown[]) => Promise<unknown>,
  key: string,
  value: string,
  lifetimeMs: number
) {
  await run(
    `insert into hub.session_entries (key, value, expires_at)
     values ($1, $2, ${expiry})
     on conflict (key) do update
       set value = excluded.value, expires_at = excluded.expires_at`,
    [key, value, lifetimeMs]
  )
}

function lockLogin(client: PoolClient, cancelKey: string) {
  return client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
    cancelKey,
  ])
}

export const postgresSessionBackend: HubSessionBackend = {
  async set(key, value, lifetimeMs) {
    removeExpiredEntries()
    await upsert(query, key, value, lifetimeMs)
  },
  async get(key) {
    const result = await query(
      "select value from hub.session_entries where key = $1 and expires_at > now()",
      [key]
    )
    return (result.rows[0]?.value as string | undefined) ?? null
  },
  async take(key) {
    const result = await query(
      `delete from hub.session_entries where key = $1
       returning value, expires_at > now() as live`,
      [key]
    )
    const row = result.rows[0] as { value: string; live: boolean } | undefined
    return row?.live ? row.value : null
  },
  async compareAndSet(key, expected, value, lifetimeMs) {
    const result = await query(
      `update hub.session_entries set value = $4, expires_at = ${expiry}
       where key = $1 and value = $2 and expires_at > now()`,
      [key, expected, lifetimeMs, value]
    )
    return result.rowCount === 1
  },
  async move(key, nextKey, expected, value, lifetimeMs) {
    const result = await query(
      `with removed as (
         delete from hub.session_entries
         where key = $1 and value = $2 and expires_at > now()
         returning key
       )
       insert into hub.session_entries (key, value, expires_at)
       select $4, $5, ${expiry} from removed
       on conflict (key) do update
         set value = excluded.value, expires_at = excluded.expires_at`,
      [key, expected, lifetimeMs, nextKey, value]
    )
    return result.rowCount === 1
  },
  async cancelLogin(cancelKey, transactionKey, lifetimeMs) {
    await transaction(async (client) => {
      await lockLogin(client, cancelKey)
      await upsert(
        (text, values) => client.query(text, values),
        cancelKey,
        "1",
        lifetimeMs
      )
      await client.query("delete from hub.session_entries where key = $1", [
        transactionKey,
      ])
    })
  },
  async issueAfterLogin(input) {
    removeExpiredEntries()
    return transaction(async (client) => {
      await lockLogin(client, input.cancelKey)
      const cancelled = await client.query(
        "select 1 from hub.session_entries where key = $1 and expires_at > now()",
        [input.cancelKey]
      )
      if (cancelled.rowCount) return false
      const run = (text: string, values: unknown[]) =>
        client.query(text, values)
      await upsert(run, input.sessionKey, input.value, input.lifetimeMs)
      if (input.previousKey !== input.sessionKey) {
        await client.query("delete from hub.session_entries where key = $1", [
          input.previousKey,
        ])
      }
      await upsert(
        run,
        input.issuedKey,
        input.sessionKey,
        input.issuedLifetimeMs
      )
      return true
    })
  },
}
