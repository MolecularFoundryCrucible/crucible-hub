export type HubApiErrorKind =
  | "unauthenticated"
  | "reauthentication-required"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "validation"
  | "rate-limited"
  | "cancelled"
  | "timeout"
  | "upstream"
  | "unexpected"

export type HubConflictField = "email" | "username"

export type HubApiError = {
  kind: HubApiErrorKind
  message: string
  correlationId: string
  retryable: boolean
  fieldErrors?: Record<string, string[]>
  retryAfterSeconds?: number
  conflictFields?: HubConflictField[]
}
