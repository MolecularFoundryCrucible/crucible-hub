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
  "storage_location_invalid",
  "replace_in_progress",
  "file_changed",
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
  readonly valueIssues?: { field: string; kind: ValueIssueKind }[]

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
    if (source.status === 409) {
      this.conflictFields = readConflictFields(body)
      this.conflictCode = readConflictCode(body)
    }
    if (source.status === 422) {
      const issues = readValueIssues(body)
      if (issues.length > 0) this.valueIssues = issues
    }
  }
}

export type ValueIssueKind = "invalid_number" | "unsupported_character"

function readValueIssues(
  body: unknown
): { field: string; kind: ValueIssueKind }[] {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (!Array.isArray(detail)) return []
  return detail.flatMap((entry: unknown) => {
    const issue = entry as { loc?: unknown; type?: unknown }
    if (
      issue.type !== "invalid_number" &&
      issue.type !== "unsupported_character"
    )
      return []
    const path = Array.isArray(issue.loc)
      ? issue.loc.filter((part) => part !== "body").map(String)
      : []
    const kind: ValueIssueKind = issue.type
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
