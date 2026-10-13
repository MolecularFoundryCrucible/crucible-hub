import type { HubApiError, HubConflictField } from "./errors"

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

export function hubOperationError(error: unknown, action: string) {
  return hubErrorMessage(error, `Could not ${action}. Try again.`)
}

export function hubConflictFields(
  error: unknown,
  fallback: readonly HubConflictField[]
): readonly HubConflictField[] {
  if (!(error instanceof HubApiClientError)) return []
  if (error.details.kind !== "conflict") return []
  return error.details.conflictFields ?? fallback
}

export function unwrapHubResult<T>(result: HubResult<T>): T {
  if (result.status === "ok") return result.data
  throw new HubApiClientError(result.error)
}
