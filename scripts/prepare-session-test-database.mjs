import pg from "pg"

import { setupSessionStore } from "./setup-session-store.mjs"

const adminUrl = process.env.HUB_TEST_SESSION_ADMIN_DATABASE_URL
if (!adminUrl) throw new Error("Set HUB_TEST_SESSION_ADMIN_DATABASE_URL.")

const admin = new pg.Client({ connectionString: adminUrl })
await admin.connect()
try {
  await setupSessionStore(admin, "app")
} finally {
  await admin.end()
}

const appUrl = new URL(adminUrl)
appUrl.username = "crucible_hub_app"
appUrl.password = "app"
console.log(`HUB_TEST_SESSION_DATABASE_URL=${appUrl.href}`)
