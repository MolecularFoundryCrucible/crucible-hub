export type HubApiErrorKind =
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "validation"
  | "rate-limited"
  | "cancelled"
  | "timeout"
  | "upstream"
  | "unexpected"

export type HubApiError = {
  kind: HubApiErrorKind
  message: string
  correlationId: string
  retryable: boolean
  fieldErrors?: Record<string, string[]>
  retryAfterSeconds?: number
}
