import "@tanstack/react-start/server-only"

import { z } from "zod"

import type { HubConflictCode, HubConflictField } from "@/data/crucible/errors"
import { readRetryAfterSeconds } from "@/lib/retry-after"

const conflictBodySchema = z.object({
  detail: z.object({
    code: z.literal("already_in_use"),
    fields: z.array(z.string()),
  }),
})

const conflictFields = new Set<string>(["email", "username"])

const conflictCodeBodySchema = z.object({
  detail: z.object({ code: z.string() }),
})

const publicationFailureSchema = z.object({
  detail: z.string().regex(/^Upload could not be published: [a-z_]+$/),
})

function isFrameworkNotFound(body: unknown) {
  return (
    typeof body === "object" &&
    body !== null &&
    "detail" in body &&
    body.detail === "Not Found"
  )
}

function readConflictCode(body: unknown) {
  const parsed = conflictCodeBodySchema.safeParse(body)
  if (parsed.success) return parsed.data.detail.code
  const publication = publicationFailureSchema.safeParse(body)
  return publication.success
    ? publication.data.detail.slice(
        publication.data.detail.lastIndexOf(" ") + 1
      )
    : undefined
}

const hubConflictCodes = new Set<string>([
  "lead_must_be_caller",
  "project_id_reserved",
  "already_member",
  "join_request_pending",
  "too_many_pending_requests",
  "project_not_accepting_requests",
  "service_account_cannot_request",
  "join_request_closed",
  "project_not_found",
  "filename_exists",
  "filename_immutable",
  "pending_deletion",
  "storage_location_invalid",
  "replace_in_progress",
  "file_changed",
  "identity_lookup_off",
  "last_sign_in_method",
  "link_expired",
  "already_yours",
  "linked_elsewhere",
  "second_orcid",
  "orcid_of_another",
  "not_pending",
  "still_referenced",
  "too_many_links",
  "too_many_keys",
  "hub_session_required",
  "browser_sign_in_required",
  "username_required",
  "service_account",
  "password_changed",
  "no_password",
  "account_disabled",
  "account_pending",
  "feature_disabled",
])

export function isHubConflictCode(code: unknown): code is HubConflictCode {
  return typeof code === "string" && hubConflictCodes.has(code)
}

function readConflictFields(body: unknown): HubConflictField[] | undefined {
  const parsed = conflictBodySchema.safeParse(body)
  if (!parsed.success) return undefined
  const fields = parsed.data.detail.fields.filter(
    (field): field is HubConflictField => conflictFields.has(field)
  )
  return fields.length ? fields : undefined
}

export function isStepUpChallenge(response: Response) {
  return (
    response.status === 401 &&
    /\berror="insufficient_user_authentication"/.test(
      response.headers.get("WWW-Authenticate") ?? ""
    )
  )
}

export class CrucibleResponseError extends Error {
  readonly status: number
  readonly retryAfterSeconds?: number
  readonly conflictFields?: HubConflictField[]
  readonly conflictCode?: string
  readonly reauthenticationRequired: boolean = false
  readonly routeMissing: boolean = false
  readonly valueIssues?: { field: string; kind: ValueIssueKind }[]
  readonly invalidParameters?: string[]

  constructor(source: number | Response, body?: unknown) {
    super("The Crucible API rejected the request.")
    this.name = "CrucibleResponseError"
    if (typeof source === "number") {
      this.status = source
      return
    }
    this.status = source.status
    this.retryAfterSeconds = readRetryAfterSeconds(source.headers)
    this.reauthenticationRequired = isStepUpChallenge(source)
    this.routeMissing =
      source.status === 405 ||
      (source.status === 404 && isFrameworkNotFound(body))
    if (source.status === 409) this.conflictFields = readConflictFields(body)
    if ([403, 404, 409, 429, 501].includes(source.status)) {
      this.conflictCode = readConflictCode(body)
    }
    if (source.status === 422) {
      const issues = readValueIssues(body)
      if (issues.length > 0) this.valueIssues = issues
      const parameters = readInvalidParameters(body)
      if (parameters.length > 0) this.invalidParameters = parameters
    }
  }
}

export type ValueIssueKind =
  | "invalid_number"
  | "unsupported_character"
  | "current_password_required"
  | "current_password_invalid"
  | `password_${PasswordRejection}`

type PasswordRejection = "too_short" | "too_long" | "common" | "personal"

const passwordRejections = new Set<string>([
  "too_short",
  "too_long",
  "common",
  "personal",
])

function valueIssueKind(issue: {
  ctx?: unknown
  type?: unknown
}): ValueIssueKind | undefined {
  switch (issue.type) {
    case "invalid_number":
    case "unsupported_character":
    case "current_password_required":
    case "current_password_invalid":
      return issue.type
    case "password_rejected": {
      const reason = (issue.ctx as { reason?: unknown } | null)?.reason
      return typeof reason === "string" && passwordRejections.has(reason)
        ? `password_${reason as PasswordRejection}`
        : undefined
    }
    default:
      return undefined
  }
}

/** Where FastAPI says a request was invalid, such as "query.affiliation.0". */
function readInvalidParameters(body: unknown): string[] {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (!Array.isArray(detail)) return []
  return detail.flatMap((entry: unknown) => {
    const loc = (entry as { loc?: unknown } | null)?.loc
    return Array.isArray(loc) ? [loc.map(String).join(".")] : []
  })
}

function readValueIssues(
  body: unknown
): { field: string; kind: ValueIssueKind }[] {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (!Array.isArray(detail)) return []
  return detail.flatMap((entry: unknown) => {
    const issue = entry as { ctx?: unknown; loc?: unknown; type?: unknown }
    const kind = valueIssueKind(issue)
    if (!kind) return []
    const path = Array.isArray(issue.loc)
      ? issue.loc.filter((part) => part !== "body").map(String)
      : []
    return [{ field: path.join(".") || "value", kind }]
  })
}

export class CrucibleContractError extends Error {
  readonly contract: string
  readonly issues: readonly { code: string; path: string }[]

  constructor(
    contract: string,
    issues: readonly { code: string; path: PropertyKey[] }[]
  ) {
    super("The Crucible API response did not match its contract.")
    this.name = "CrucibleContractError"
    this.contract = contract
    this.issues = issues.map((issue) => ({
      code: issue.code,
      path: issue.path.map(String).join("."),
    }))
  }
}
