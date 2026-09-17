import type { HubApiError } from "./errors"

export type HubResult<T> =
  { status: "ok"; data: T } | { status: "error"; error: HubApiError }

export class HubApiClientError extends Error {
  readonly details: HubApiError

  constructor(details: HubApiError) {
    super(`${details.message} Reference: ${details.correlationId}`)
    this.name = "HubApiClientError"
    this.details = details
  }
}

export function hubErrorMessage(error: unknown, fallback: string) {
  return error instanceof HubApiClientError ? error.message : fallback
}

export function unwrapHubResult<T>(result: HubResult<T>): T {
  if (result.status === "ok") return result.data
  throw new HubApiClientError(result.error)
}
