import pg from "pg"

import { applySessionStoreMigrations } from "./migrate-session-store.mjs"

const adminUrl = process.env.HUB_TEST_SESSION_ADMIN_DATABASE_URL
if (!adminUrl) throw new Error("Set HUB_TEST_SESSION_ADMIN_DATABASE_URL.")

const admin = new pg.Client({ connectionString: adminUrl })
await admin.connect()
try {
  await admin.query(`
    do $$
    begin
      if not exists (select from pg_roles where rolname = 'crucible_hub_owner') then
        create role crucible_hub_owner login password 'owner';
      end if;
      if not exists (select from pg_roles where rolname = 'crucible_hub_app') then
        create role crucible_hub_app login password 'app';
      end if;
    end
    $$;
    revoke create on schema public from public;
    create schema if not exists hub authorization crucible_hub_owner;
  `)
} finally {
  await admin.end()
}

const ownerUrl = new URL(adminUrl)
ownerUrl.username = "crucible_hub_owner"
ownerUrl.password = "owner"
const owner = new pg.Client({ connectionString: ownerUrl.href })
await owner.connect()
try {
  await applySessionStoreMigrations(owner)
} finally {
  await owner.end()
}

const appUrl = new URL(adminUrl)
appUrl.username = "crucible_hub_app"
appUrl.password = "app"
console.log(`HUB_TEST_SESSION_DATABASE_URL=${appUrl.href}`)
