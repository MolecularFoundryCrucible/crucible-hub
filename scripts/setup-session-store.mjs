import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import pg from "pg"

import { applySessionStoreMigrations } from "./migrate-session-store.mjs"

const ownerRole = "crucible_hub_owner"
const appRole = "crucible_hub_app"

// Same order as the Hub server and the Crucible API.
export function readSecretSetting(name) {
  const file = process.env[`${name}_FILE`]
  if (file) return readFileSync(file, "utf8").replace(/\r?\n$/, "")
  const mounted = join("/run/secrets", name)
  if (existsSync(mounted)) {
    return readFileSync(mounted, "utf8").replace(/\r?\n$/, "")
  }
  return process.env[name] || undefined
}

/**
 * Creates the Hub's session roles and schema in the connected database and
 * applies the session migrations. The owner role cannot sign in; migrations
 * run as it through SET ROLE, so the admin connection must be a superuser or
 * a member of it. Safe to repeat; the app password is reset each time.
 */
export async function setupSessionStore(admin, appPassword) {
  const password = admin.escapeLiteral(appPassword)
  await admin.query(`
    do $$
    begin
      if not exists (select from pg_roles where rolname = '${ownerRole}') then
        create role ${ownerRole} nologin;
      end if;
      if not exists (select from pg_roles where rolname = '${appRole}') then
        create role ${appRole} login;
      end if;
    end
    $$;
    alter role ${appRole} with login password ${password};
    revoke create on schema public from public;
    create schema if not exists hub authorization ${ownerRole};
  `)
  const { rows } = await admin.query("select current_database() as name")
  await admin.query(
    `grant connect on database ${admin.escapeIdentifier(rows[0].name)} to ${appRole}`
  )
  await admin.query(`set role ${ownerRole}`)
  try {
    return await applySessionStoreMigrations(admin)
  } finally {
    await admin.query("reset role")
  }
}

function adminConnectionString() {
  const value = readSecretSetting("HUB_SESSION_ADMIN_DATABASE_URL")
  if (!value) throw new Error("Set HUB_SESSION_ADMIN_DATABASE_URL.")
  const url = new URL(value)
  const password = readSecretSetting("HUB_SESSION_ADMIN_DATABASE_PASSWORD")
  if (password && !url.password) url.password = encodeURIComponent(password)
  return url.toString()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const appPassword = readSecretSetting("HUB_SESSION_DATABASE_PASSWORD")
  if (!appPassword) throw new Error("Set HUB_SESSION_DATABASE_PASSWORD.")
  const admin = new pg.Client({ connectionString: adminConnectionString() })
  await admin.connect()
  try {
    const ran = await setupSessionStore(admin, appPassword)
    console.log(
      ran.length > 0
        ? `Session store ready; applied ${ran.join(", ")}.`
        : "Session store ready; the schema is up to date."
    )
  } finally {
    await admin.end()
  }
}
