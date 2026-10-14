import { readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import pg from "pg"

const migrationsDirectory = resolve(
  fileURLToPath(new URL("..", import.meta.url)),
  "migrations/session-store"
)

export async function applySessionStoreMigrations(client) {
  const schema = await client.query(
    "select 1 from pg_namespace where nspname = 'hub'"
  )
  if (schema.rowCount !== 1) {
    throw new Error("Schema hub does not exist; the database owner creates it.")
  }
  await client.query(
    "select pg_advisory_lock(hashtextextended('hub.migrations', 0))"
  )
  try {
    await client.query(
      `create table if not exists hub.schema_migrations (
         version text primary key,
         applied_at timestamptz not null default now()
       )`
    )
    const applied = new Set(
      (
        await client.query("select version from hub.schema_migrations")
      ).rows.map((row) => row.version)
    )
    const files = (await readdir(migrationsDirectory))
      .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
      .sort()
    const ran = []
    for (const file of files) {
      const version = file.slice(0, -".sql".length)
      if (applied.has(version)) continue
      const sql = await readFile(resolve(migrationsDirectory, file), "utf8")
      await client.query("begin")
      try {
        await client.query(sql)
        await client.query(
          "insert into hub.schema_migrations (version) values ($1)",
          [version]
        )
        await client.query("commit")
      } catch (error) {
        await client.query("rollback")
        throw error
      }
      ran.push(version)
    }
    return ran
  } finally {
    await client.query(
      "select pg_advisory_unlock(hashtextextended('hub.migrations', 0))"
    )
  }
}

async function connect() {
  const instance = process.env.HUB_SESSION_DATABASE_INSTANCE
  if (!instance) {
    const url = process.env.HUB_SESSION_DATABASE_URL
    if (!url) {
      throw new Error(
        "Set HUB_SESSION_DATABASE_INSTANCE or HUB_SESSION_DATABASE_URL."
      )
    }
    const client = new pg.Client({ connectionString: url })
    await client.connect()
    return { client, close: () => client.end() }
  }
  const password = process.env.HUB_SESSION_DATABASE_PASSWORD
  if (!password) throw new Error("Set HUB_SESSION_DATABASE_PASSWORD.")
  const { AuthTypes, Connector, IpAddressTypes } =
    await import("@google-cloud/cloud-sql-connector")
  const connector = new Connector()
  const options = await connector.getOptions({
    instanceConnectionName: instance,
    ipType: IpAddressTypes.PUBLIC,
    authType: AuthTypes.PASSWORD,
  })
  const client = new pg.Client({
    ...options,
    database: process.env.HUB_SESSION_DATABASE_NAME ?? "crucible_hub",
    user: process.env.HUB_SESSION_DATABASE_USER ?? "crucible_hub_owner",
    password,
  })
  await client.connect()
  return {
    client,
    close: async () => {
      await client.end()
      connector.close()
    },
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { client, close } = await connect()
  try {
    const ran = await applySessionStoreMigrations(client)
    console.log(
      ran.length > 0
        ? `Applied ${ran.join(", ")}.`
        : "The session store schema is up to date."
    )
  } finally {
    await close()
  }
}
