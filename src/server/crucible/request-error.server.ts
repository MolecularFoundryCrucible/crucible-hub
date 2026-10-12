import "@tanstack/react-start/server-only"

import { z } from "zod"

import type { HubConflictField } from "@/data/crucible/errors"
import { readRetryAfterSeconds } from "@/lib/retry-after"

const conflictBodySchema = z.object({
  detail: z.object({
    code: z.literal("already_in_use"),
    fields: z.array(z.string()),
  }),
})

const conflictFields = new Set<string>(["email", "username"])

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
  readonly reauthenticationRequired: boolean = false

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
    if (source.status === 409) this.conflictFields = readConflictFields(body)
  }
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
