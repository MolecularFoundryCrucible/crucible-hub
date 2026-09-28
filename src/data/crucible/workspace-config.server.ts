import "@tanstack/react-start/server-only"

import {
  hasHubSession,
  sessionApiFetch,
} from "@/server/crucible/hub-auth.server"

export type WorkspaceConfiguration =
  | { mode: "fixture" }
  | { mode: "api"; baseUrl: string; bearerToken?: string; fetch?: typeof fetch }
  | { mode: "unavailable"; reason: string }

function isTrustedApiUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["127.0.0.1", "::1", "localhost"].includes(url.hostname))
    )
  } catch {
    return false
  }
}

export function readWorkspaceConfiguration(): WorkspaceConfiguration {
  if (process.env.HUB_DATA_SOURCE === "hub-auth") {
    const baseUrl = process.env.CRUCIBLE_API_BASE_URL
    if (process.env.NODE_ENV === "production") {
      return {
        mode: "unavailable",
        reason: "Hub session storage is not configured for production.",
      }
    }
    if (
      !baseUrl ||
      !isTrustedApiUrl(baseUrl) ||
      !baseUrl.startsWith("https://")
    ) {
      return {
        mode: "unavailable",
        reason: "Hub sign-in requires a trusted HTTPS API URL.",
      }
    }
    if (!process.env.HUB_AUTH_CLIENT_SECRET) {
      return { mode: "unavailable", reason: "Hub sign-in is not configured." }
    }
    if (!hasHubSession())
      return {
        mode: "unavailable",
        reason: "Sign in to Crucible Hub to continue.",
      }
    return { mode: "api", baseUrl, fetch: sessionApiFetch() }
  }
  if (process.env.HUB_DATA_SOURCE !== "api") return { mode: "fixture" }

  if (process.env.NODE_ENV === "production") {
    return {
      mode: "unavailable",
      reason: "Development API-key access is disabled in production.",
    }
  }

  const baseUrl = process.env.CRUCIBLE_API_BASE_URL
  const bearerToken = process.env.CRUCIBLE_API_KEY

  if (!baseUrl || !bearerToken) {
    return {
      mode: "unavailable",
      reason:
        "Local API mode requires CRUCIBLE_API_BASE_URL and CRUCIBLE_API_KEY.",
    }
  }

  if (!isTrustedApiUrl(baseUrl)) {
    return {
      mode: "unavailable",
      reason:
        "CRUCIBLE_API_BASE_URL must use HTTPS or point to the local machine.",
    }
  }

  return { mode: "api", baseUrl, bearerToken }
}
