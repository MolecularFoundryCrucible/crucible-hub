import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  assertSecretSettingsGivenOnce,
  clearSecretSettingCache,
  clientAddress,
  readSecretSetting,
  serverApiUrlAllowed,
  trustedProxyHops,
} from "./deployment-settings.server"

afterEach(() => {
  vi.unstubAllEnvs()
  clearSecretSettingCache()
})

describe("secret settings", () => {
  function secretFile(name: string, value: string) {
    const directory = mkdtempSync(join(tmpdir(), "hub-secret-"))
    writeFileSync(join(directory, name), value)
    return { directory, file: join(directory, name) }
  }

  it.each([
    [
      "the variable",
      () => vi.stubEnv("HUB_TEST_SECRET", "from-env"),
      undefined,
    ],
    [
      "NAME_FILE",
      () =>
        vi.stubEnv(
          "HUB_TEST_SECRET_FILE",
          secretFile("pointed", "from-file\n").file
        ),
      undefined,
    ],
    [
      "the secrets directory",
      () => undefined,
      secretFile("HUB_TEST_SECRET", "from-mount\n").directory,
    ],
  ])("reads a secret given only as %s", (_label, give, directory) => {
    give()
    expect(readSecretSetting("HUB_TEST_SECRET", directory)).toMatch(/^from-/)
    expect(readSecretSetting("HUB_TEST_SECRET", directory)).not.toMatch(/\n$/)
  })

  it("refuses a secret given more than one way, naming the ways", () => {
    vi.stubEnv("HUB_TEST_SECRET", "from-env")
    vi.stubEnv("HUB_TEST_SECRET_FILE", secretFile("pointed", "from-file").file)
    expect(() => readSecretSetting("HUB_TEST_SECRET")).toThrow(
      "HUB_TEST_SECRET is given more than one way (HUB_TEST_SECRET, HUB_TEST_SECRET_FILE); give it one way only."
    )
    vi.unstubAllEnvs()
    const { directory } = secretFile("HUB_TEST_SECRET", "from-mount")
    vi.stubEnv("HUB_TEST_SECRET", "from-env")
    expect(() => readSecretSetting("HUB_TEST_SECRET", directory)).toThrow(
      /given more than one way/
    )
  })

  it("treats blank values as not given and refuses an empty NAME_FILE", () => {
    const { directory } = secretFile("HUB_TEST_SECRET", "  \n")
    vi.stubEnv("HUB_TEST_SECRET", " ")
    expect(readSecretSetting("HUB_TEST_SECRET", directory)).toBeUndefined()
    vi.stubEnv("HUB_TEST_SECRET", "from-env")
    expect(readSecretSetting("HUB_TEST_SECRET", directory)).toBe("from-env")
    vi.stubEnv("HUB_TEST_SECRET_FILE", secretFile("empty", "").file)
    expect(() => readSecretSetting("HUB_TEST_SECRET")).toThrow(
      "HUB_TEST_SECRET_FILE names an empty file."
    )
  })

  it("checks every secret setting at startup", () => {
    vi.stubEnv("HUB_SESSION_KEYS", "k1:abc")
    vi.stubEnv("HUB_SESSION_KEYS_FILE", secretFile("keys", "k1:abc").file)
    expect(() => assertSecretSettingsGivenOnce()).toThrow(
      /HUB_SESSION_KEYS is given more than one way/
    )
  })
})

describe("server API URL", () => {
  it("accepts HTTPS and loopback HTTP", () => {
    expect(serverApiUrlAllowed("https://crucible.example/api/v3")).toBe(true)
    expect(serverApiUrlAllowed("http://127.0.0.1:8000")).toBe(true)
    expect(serverApiUrlAllowed("http://api:8000")).toBe(false)
  })

  it("accepts a private HTTP address only when opted in", () => {
    vi.stubEnv("HUB_API_ALLOW_HTTP", "true")
    expect(serverApiUrlAllowed("http://api:8000")).toBe(true)
    expect(serverApiUrlAllowed("http://10.128.0.83:7777")).toBe(true)
    expect(serverApiUrlAllowed("http://172.18.0.4:8000")).toBe(true)
    expect(serverApiUrlAllowed("http://192.168.1.20:8000")).toBe(true)
    expect(serverApiUrlAllowed("http://[fd00::4]:8000")).toBe(true)
    expect(serverApiUrlAllowed("ftp://api:8000")).toBe(false)
  })

  it("refuses HTTP to a public name or address even when opted in", () => {
    vi.stubEnv("HUB_API_ALLOW_HTTP", "true")
    expect(serverApiUrlAllowed("http://crucible.example.org/api/v3")).toBe(
      false
    )
    expect(serverApiUrlAllowed("http://35.188.216.232:7777")).toBe(false)
    expect(serverApiUrlAllowed("http://172.32.0.1:8000")).toBe(false)
    expect(serverApiUrlAllowed("http://[2001:db8::1]:8000")).toBe(false)
  })

  it("rejects credentials, queries, and fragments", () => {
    expect(serverApiUrlAllowed("https://user:pw@crucible.example")).toBe(false)
    expect(serverApiUrlAllowed("https://crucible.example/?a=1")).toBe(false)
    expect(serverApiUrlAllowed("https://crucible.example/#a")).toBe(false)
  })
})

describe("client address", () => {
  it("trusts one proxy by default", () => {
    expect(trustedProxyHops()).toBe(1)
    expect(clientAddress("203.0.113.7", "10.0.0.2")).toBe("203.0.113.7")
    expect(clientAddress("198.51.100.1, 203.0.113.7", "10.0.0.2")).toBe(
      "203.0.113.7"
    )
  })

  it("reads further left for each additional trusted proxy", () => {
    vi.stubEnv("HUB_TRUSTED_PROXY_HOPS", "2")
    expect(clientAddress("198.51.100.1, 203.0.113.7", "10.0.0.2")).toBe(
      "198.51.100.1"
    )
    expect(clientAddress("203.0.113.7", "10.0.0.2")).toBe("10.0.0.2")
  })

  it("ignores the header when no proxy is trusted", () => {
    vi.stubEnv("HUB_TRUSTED_PROXY_HOPS", "0")
    expect(clientAddress("203.0.113.7", "10.0.0.2")).toBe("10.0.0.2")
  })

  it("rejects a hop count that is not a whole number", () => {
    vi.stubEnv("HUB_TRUSTED_PROXY_HOPS", "one")
    expect(() => trustedProxyHops()).toThrow("whole number")
  })
})
