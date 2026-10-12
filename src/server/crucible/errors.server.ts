import "@tanstack/react-start/server-only"

import type {
  HubApiError,
  HubApiErrorKind,
  HubConflictField,
} from "@/data/crucible/errors"

type ErrorInput = {
  status?: number
  correlationId: string
  cancelled?: boolean
  timedOut?: boolean
  fieldErrors?: Record<string, string[]>
  retryAfterSeconds?: number
  conflictFields?: HubConflictField[]
  reauthenticationRequired?: boolean
}

const statusKinds: Partial<Record<number, HubApiErrorKind>> = {
  400: "validation",
  401: "unauthenticated",
  403: "forbidden",
  404: "not-found",
  409: "conflict",
  413: "validation",
  422: "validation",
  429: "rate-limited",
}

const messages: Record<HubApiErrorKind, string> = {
  unauthenticated: "Sign in is required.",
  "reauthentication-required": "Sign in again to continue.",
  forbidden: "You do not have permission to perform this action.",
  "not-found": "The requested Crucible resource was not found.",
  conflict: "The request conflicts with the current Crucible state.",
  validation: "Some request values are invalid.",
  "rate-limited": "Too many requests were made. Try again shortly.",
  cancelled: "The request was cancelled.",
  timeout: "Crucible did not respond in time.",
  upstream: "Crucible could not complete the request.",
  unexpected: "An unexpected error occurred.",
}

export function toHubApiError(input: ErrorInput): HubApiError {
  const kind = input.cancelled
    ? "cancelled"
    : input.timedOut
      ? "timeout"
      : input.reauthenticationRequired
        ? "reauthentication-required"
        : input.status
          ? (statusKinds[input.status] ?? "upstream")
          : "unexpected"

  return {
    kind,
    message: messages[kind],
    correlationId: input.correlationId,
    retryable: ["rate-limited", "timeout", "upstream", "unexpected"].includes(
      kind
    ),
    ...(input.fieldErrors ? { fieldErrors: input.fieldErrors } : {}),
    ...(input.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: input.retryAfterSeconds }),
    ...(input.conflictFields ? { conflictFields: input.conflictFields } : {}),
  }
}
