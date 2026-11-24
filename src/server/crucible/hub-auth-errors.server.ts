import "@tanstack/react-start/server-only"

import { z } from "zod"

export class TokenRequestError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterSeconds?: number
  ) {
    super("The Crucible sign-in request failed.")
  }
}

export class HubAccountMismatchError extends Error {
  constructor() {
    super("A different account returned from re-confirming a sign-in.")
  }
}

export class HubLoginUnavailableError extends Error {
  constructor(
    readonly reason:
      | "cancelled-transaction"
      | "expired-transaction"
      | "missing-login-cookie"
      | "reused-transaction"
      | "unknown-transaction"
  ) {
    super("The sign-in request has expired.")
  }
}

export class HubStaleSignInError extends Error {
  constructor() {
    super("Re-confirming a sign-in did not return a recent sign-in.")
  }
}

const providerErrors = new Set([
  "access_denied",
  "login_required",
  "temporarily_unavailable",
  "server_error",
])

export class HubSignInRefusedError extends Error {
  readonly error: string

  constructor(error: string) {
    super("The sign-in provider returned an error.")
    this.error = providerErrors.has(error) ? error : "other"
  }
}

export function hubSignInFailureDetails(error: unknown) {
  if (error instanceof HubAccountMismatchError) {
    return { reason: "account-mismatch" }
  }
  if (error instanceof HubStaleSignInError) {
    return { reason: "stale-sign-in" }
  }
  if (error instanceof HubSignInRefusedError) {
    return { reason: "provider-error", error: error.error }
  }
  if (error instanceof HubLoginUnavailableError) {
    return { reason: error.reason }
  }
  if (error instanceof TokenRequestError) {
    return { reason: "token-exchange-rejected", status: error.status }
  }
  if (error instanceof z.ZodError) {
    return { reason: "invalid-token-response" }
  }
  if (error instanceof Error) {
    const knownReasons: Record<string, string> = {
      "Invalid sign-in response.": "invalid-callback-response",
      "The sign-in request could not be verified.": "state-mismatch",
      "Hub sign-in is not configured.": "configuration",
      "Hub sign-in callback is not configured correctly.": "configuration",
      "Hub API URL must be a trusted HTTPS URL.": "configuration",
    }
    return {
      reason:
        knownReasons[error.message] ??
        (error.name === "TypeError" ? "api-connection" : "unexpected"),
    }
  }
  return { reason: "unexpected" }
}

export type HubSignInErrorReason =
  "account-mismatch" | "stale-sign-in" | "unavailable"

export function hubSignInErrorReason(
  details: ReturnType<typeof hubSignInFailureDetails>
): HubSignInErrorReason | null {
  if (details.reason === "account-mismatch") return "account-mismatch"
  if (details.reason === "stale-sign-in") return "stale-sign-in"
  if (details.reason !== "provider-error") return null
  if (details.error === "login_required") return "account-mismatch"
  return details.error === "temporarily_unavailable" ||
    details.error === "server_error"
    ? "unavailable"
    : null
}

export class HubLoginRateLimitError extends Error {
  constructor() {
    super("Too many sign-in requests. Try again shortly.")
    this.name = "HubLoginRateLimitError"
  }
}
