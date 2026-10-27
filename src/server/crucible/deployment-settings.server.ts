import "@tanstack/react-start/server-only"

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const secretsDirectory = "/run/secrets"
const fileContents = new Map<string, string>()

function readSecretFile(path: string) {
  let value = fileContents.get(path)
  if (value === undefined) {
    value = readFileSync(path, "utf8").replace(/\r?\n$/, "")
    fileContents.set(path, value)
  }
  return value
}

/**
 * A secret setting read the way the Crucible API reads its own: the file named
 * by NAME_FILE, then /run/secrets/NAME (Docker and Kubernetes secrets), then
 * the NAME environment variable.
 */
export function readSecretSetting(name: string): string | undefined {
  const file = process.env[`${name}_FILE`]
  if (file) return readSecretFile(file)
  const mounted = join(secretsDirectory, name)
  if (fileContents.has(mounted) || existsSync(mounted)) {
    return readSecretFile(mounted)
  }
  return process.env[name] || undefined
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
