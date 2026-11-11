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
  | "unavailable"
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
  | "not_pending"
  | "still_referenced"
  | "too_many_links"
  | "too_many_keys"
  | "hub_session_required"
  | "browser_sign_in_required"
  | "username_required"
  | "service_account"
  | "password_changed"
  | "no_password"
  | "account_disabled"
  | "account_pending"
  | "feature_disabled"
  | "lead_must_be_caller"
  | "project_id_reserved"
  | "already_member"
  | "join_request_pending"
  | "too_many_pending_requests"
  | "project_not_accepting_requests"
  | "service_account_cannot_request"
  | "join_request_closed"
  | "project_not_found"
  | "filename_exists"
  | "filename_immutable"
  | "pending_deletion"

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
