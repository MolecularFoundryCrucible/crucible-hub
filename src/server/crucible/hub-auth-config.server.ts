import "@tanstack/react-start/server-only"

import { z } from "zod"
import {
  readSecretSetting,
  serverApiUrlAllowed,
} from "./deployment-settings.server"
import {
  sharedSessionsConfigured,
  sharedSessionStoreKind,
} from "./hub-session-store.server"

const localCallbackUri = "http://127.0.0.1:3000/hub/auth/callback"

export function productionHubAuthReady() {
  if (process.env.NODE_ENV !== "production") return true
  if (process.env.HUB_AUTH_PRODUCTION_ENABLED !== "true") return false
  return (
    process.env.HUB_AUTH_SESSION_MODE === "postgres" &&
    sharedSessionsConfigured() &&
    sharedSessionStoreKind() === "postgres"
  )
}

const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"])

function isHttpsOrLoopback(url: URL) {
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" && loopbackHosts.has(url.hostname))
  )
}

export function configuredCallbackUri() {
  const value = process.env.HUB_AUTH_CALLBACK_URI ?? localCallbackUri
  const url = new URL(value)
  if (
    !isHttpsOrLoopback(url) ||
    url.pathname !== "/hub/auth/callback" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("Hub sign-in callback is not configured correctly.")
  }
  return url.toString()
}

export function hubAuthPublicOrigin() {
  return new URL(configuredCallbackUri()).origin
}

export function hubSignInOrigin() {
  if (process.env.HUB_DATA_SOURCE !== "hub-auth") return null
  return hubAuthPublicOrigin()
}

const signInMethodsSchema = z
  .array(
    z.object({
      key: z.string().min(1).max(64),
      display_name: z.string().min(1).max(80),
      is_orcid: z.boolean(),
      kind: z.enum(["oidc", "password"]).catch("oidc").default("oidc"),
      registration_url: z
        .string()
        .max(2048)
        .refine(isWebUrl)
        .nullish()
        .catch(null)
        .transform((value) => value ?? null),
    })
  )
  .max(10)

function isWebUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

export type HubSignInMethod = z.infer<typeof signInMethodsSchema>[number]

export async function hubSignInMethods(): Promise<HubSignInMethod[] | null> {
  if (process.env.HUB_DATA_SOURCE !== "hub-auth") return null
  try {
    const { baseUrl } = hubAuthConfig()
    const response = await fetch(`${baseUrl}/auth/methods`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return null
    return signInMethodsSchema.parse(await response.json())
  } catch {
    return null
  }
}

function serverApiUrl(value: string) {
  if (!serverApiUrlAllowed(value)) {
    throw new Error("Hub API URL must be a trusted HTTPS URL.")
  }
  return new URL(value).toString().replace(/\/$/, "")
}

function publicApiUrl(value: string) {
  const url = new URL(value)
  if (
    !isHttpsOrLoopback(url) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Hub API URL must be a trusted HTTPS URL.")
  }
  return url.toString().replace(/\/$/, "")
}

export function cookieOptions(path: string) {
  return {
    httpOnly: true,
    path,
    sameSite: "lax" as const,
    secure: new URL(configuredCallbackUri()).protocol === "https:",
  }
}

export function hubAuthConfig() {
  const baseUrl = process.env.CRUCIBLE_API_BASE_URL
  const publicBaseUrl = process.env.HUB_AUTH_PUBLIC_API_URL ?? baseUrl
  const secret = readSecretSetting("HUB_AUTH_CLIENT_SECRET")
  const callbackUri = configuredCallbackUri()
  if (
    process.env.HUB_DATA_SOURCE !== "hub-auth" ||
    !productionHubAuthReady() ||
    !baseUrl ||
    !publicBaseUrl ||
    !secret
  ) {
    throw new Error("Hub sign-in is not configured.")
  }
  return {
    baseUrl: serverApiUrl(baseUrl),
    publicBaseUrl: publicApiUrl(publicBaseUrl),
    callbackUri,
    secret,
  }
}
