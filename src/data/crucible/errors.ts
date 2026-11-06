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

export type HubConflictCode =
  | "storage_location_invalid"
  | "replace_in_progress"
  | "file_changed"
  | "identity_lookup_off"
  | "last_sign_in_method"
  | "link_expired"
  | "already_yours"
  | "linked_elsewhere"
  | "second_orcid"
  | "orcid_of_another"

export type HubApiError = {
  kind: HubApiErrorKind
  message: string
  correlationId: string
  retryable: boolean
  fieldErrors?: Record<string, string[]>
  retryAfterSeconds?: number
  conflictFields?: HubConflictField[]
  conflictCode?: HubConflictCode
}
