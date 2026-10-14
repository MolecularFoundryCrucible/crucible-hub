import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  closePostgresSessionPool,
  postgresSessionBackend as store,
} from "./hub-session-postgres.server"

const databaseUrl = process.env.HUB_TEST_SESSION_DATABASE_URL

describe.skipIf(!databaseUrl)("Postgres Hub session backend", () => {
  beforeEach(async () => {
    vi.stubEnv("HUB_SESSION_DATABASE_URL", databaseUrl)
    const { Client } = await import("pg")
    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    await client.query(
      "delete from hub.session_entries where key like 'test:%'"
    )
    await client.end()
  })

  afterAll(async () => {
    await closePostgresSessionPool()
    vi.unstubAllEnvs()
  })

  it("stores, reads and replaces entries until they expire", async () => {
    await store.set("test:a", "one", 60_000)
    expect(await store.get("test:a")).toBe("one")
    await store.set("test:a", "two", 60_000)
    expect(await store.get("test:a")).toBe("two")
    await store.set("test:b", "short", 1)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(await store.get("test:b")).toBeNull()
  })

  it("takes an entry once and ignores expired entries", async () => {
    await store.set("test:a", "one", 60_000)
    expect(await store.take("test:a")).toBe("one")
    expect(await store.take("test:a")).toBeNull()
    await store.set("test:b", "gone", 1)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(await store.take("test:b")).toBeNull()
  })

  it("compares and sets only against the current value", async () => {
    await store.set("test:a", "one", 60_000)
    expect(await store.compareAndSet("test:a", "stale", "two", 60_000)).toBe(
      false
    )
    expect(await store.compareAndSet("test:a", "one", "two", 60_000)).toBe(true)
    expect(await store.get("test:a")).toBe("two")
    expect(
      await store.compareAndSet("test:missing", "one", "two", 60_000)
    ).toBe(false)
  })

  it("lets only one of two concurrent compare-and-set calls win", async () => {
    await store.set("test:a", "one", 60_000)
    const results = await Promise.all([
      store.compareAndSet("test:a", "one", "left", 60_000),
      store.compareAndSet("test:a", "one", "right", 60_000),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it("moves an entry to a new key only from the expected value", async () => {
    await store.set("test:a", "one", 60_000)
    expect(await store.move("test:a", "test:b", "stale", "two", 60_000)).toBe(
      false
    )
    expect(await store.get("test:a")).toBe("one")
    expect(await store.move("test:a", "test:b", "one", "two", 60_000)).toBe(
      true
    )
    expect(await store.get("test:a")).toBeNull()
    expect(await store.get("test:b")).toBe("two")
  })

  it("issues a session after login and replaces the previous one", async () => {
    await store.set("test:previous", "old", 60_000)
    const issued = await store.issueAfterLogin({
      cancelKey: "test:cancel",
      sessionKey: "test:session",
      previousKey: "test:previous",
      issuedKey: "test:issued",
      value: "sealed",
      lifetimeMs: 60_000,
      issuedLifetimeMs: 60_000,
    })
    expect(issued).toBe(true)
    expect(await store.get("test:session")).toBe("sealed")
    expect(await store.get("test:previous")).toBeNull()
    expect(await store.get("test:issued")).toBe("test:session")
  })

  it("refuses to issue a session after the login was cancelled", async () => {
    await store.set("test:transaction", "pending", 60_000)
    await store.cancelLogin("test:cancel", "test:transaction", 60_000)
    expect(await store.get("test:transaction")).toBeNull()
    const issued = await store.issueAfterLogin({
      cancelKey: "test:cancel",
      sessionKey: "test:session",
      previousKey: "test:session",
      issuedKey: "test:issued",
      value: "sealed",
      lifetimeMs: 60_000,
      issuedLifetimeMs: 60_000,
    })
    expect(issued).toBe(false)
    expect(await store.get("test:session")).toBeNull()
  })
})
