import "@tanstack/react-start/server-only"

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const fileContents = new Map<string, string>()

const secretSettingNames = [
  "CRUCIBLE_API_KEY",
  "HUB_AUTH_CLIENT_SECRET",
  "HUB_SESSION_DATABASE_PASSWORD",
  "HUB_SESSION_DATABASE_URL",
  "HUB_SESSION_KEYS",
] as const

function readSecretFile(path: string) {
  let value = fileContents.get(path)
  if (value === undefined) {
    value = readFileSync(path, "utf8").replace(/\r?\n$/, "")
    fileContents.set(path, value)
  }
  return value
}

/**
 * A secret setting read the way the Crucible API reads its own: from exactly
 * one of the file named by NAME_FILE, /run/secrets/NAME (Docker and Kubernetes
 * secrets), or the NAME environment variable. A blank value counts as not
 * given, and a setting given more than one way is refused.
 */
export function readSecretSetting(
  name: string,
  secretsDirectory = "/run/secrets"
): string | undefined {
  const ways = new Map<string, string>()
  const variable = process.env[name]
  if (variable?.trim()) ways.set(name, variable)
  const pointer = process.env[`${name}_FILE`]?.trim()
  if (pointer) {
    const value = readSecretFile(pointer)
    if (!value.trim()) throw new Error(`${name}_FILE names an empty file.`)
    ways.set(`${name}_FILE`, value)
  }
  const mounted = join(secretsDirectory, name)
  if (fileContents.has(mounted) || existsSync(mounted)) {
    const value = readSecretFile(mounted)
    if (value.trim()) ways.set(`${mounted}`, value)
  }
  if (ways.size > 1) {
    throw new Error(
      `${name} is given more than one way (${[...ways.keys()].join(", ")}); give it one way only.`
    )
  }
  return ways.values().next().value
}

/** Refuses to start when any secret setting is given more than one way. */
export function assertSecretSettingsGivenOnce() {
  for (const name of secretSettingNames) readSecretSetting(name)
}

export function clearSecretSettingCache() {
  fileContents.clear()
}

const loopbackHosts = new Set(["127.0.0.1", "::1", "[::1]", "localhost"])

function plainUrl(url: URL) {
  return !url.username && !url.password && !url.search && !url.hash
}

function privateIpv4(host: string) {
  const parts = host.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !(part >= 0 && part <= 255)))
    return false
  const [a, b] = parts
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  )
}

/** A container name (no dots) or a private address: never a public name. */
function privateNetworkHost(host: string) {
  if (/^\[f[cd][0-9a-f]{2}:/i.test(host)) return true
  if (/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/i.test(host)) return true
  return privateIpv4(host)
}

/**
 * Whether the server-to-server API base URL is acceptable: HTTPS, loopback
 * HTTP, or, with HUB_API_ALLOW_HTTP=true, HTTP to a container name or private
 * address, for an API on the same private container network.
 */
export function serverApiUrlAllowed(value: string) {
  try {
    const url = new URL(value)
    if (!plainUrl(url)) return false
    if (url.protocol === "https:") return true
    if (url.protocol !== "http:") return false
    if (loopbackHosts.has(url.hostname)) return true
    return (
      process.env.HUB_API_ALLOW_HTTP === "true" &&
      privateNetworkHost(url.hostname)
    )
  } catch {
    return false
  }
}

export function trustedProxyHops() {
  const value = process.env.HUB_TRUSTED_PROXY_HOPS
  if (value === undefined || value === "") return 1
  if (!/^\d+$/.test(value)) {
    throw new Error("HUB_TRUSTED_PROXY_HOPS must be a whole number.")
  }
  return Number(value)
}

/**
 * The client address for a request: the entry `hops` places from the right of
 * X-Forwarded-For, where each trusted proxy appends the address it received
 * the request from, or the socket address when no proxy is trusted or the
 * header is shorter than the chain.
 */
export function clientAddress(
  forwardedFor: string | null | undefined,
  socketAddress: string | undefined,
  hops = trustedProxyHops()
) {
  if (hops === 0 || !forwardedFor) return socketAddress
  const entries = forwardedFor
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
  return entries.length >= hops ? entries[entries.length - hops] : socketAddress
}
