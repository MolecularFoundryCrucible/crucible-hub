import "@tanstack/react-start/server-only"

import type { HubResult } from "@/data/crucible/result"

import { toHubApiError } from "./errors.server"
import type { ValueIssueKind } from "./request-error.server"
import {
  CrucibleContractError,
  CrucibleResponseError,
  isHubConflictCode,
} from "./request-error.server"

type SafeCrucibleCallOptions = {
  operation?: string
}

export async function safeCrucibleCall<T>(
  correlationId: string,
  operation: () => Promise<T>,
  options: SafeCrucibleCallOptions = {}
): Promise<HubResult<T>> {
  try {
    return { status: "ok", data: await operation() }
  } catch (error) {
    const status =
      error instanceof CrucibleResponseError ? error.status : undefined
    const cancelled =
      error instanceof DOMException && error.name === "AbortError"
    if (!cancelled) {
      console.error("[Crucible Hub] Server operation failed", {
        contract:
          error instanceof CrucibleContractError ? error.contract : undefined,
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
        issues:
          error instanceof CrucibleContractError ? error.issues : undefined,
        operation: options.operation ?? "crucible-api",
        status,
      })
    }
    return {
      status: "error",
      error: toHubApiError({
        correlationId,
        status,
        cancelled,
        timedOut:
          error instanceof DOMException && error.name === "TimeoutError",
        retryAfterSeconds:
          error instanceof CrucibleResponseError
            ? error.retryAfterSeconds
            : undefined,
        conflictFields:
          error instanceof CrucibleResponseError
            ? error.conflictFields
            : undefined,
        conflictCode:
          error instanceof CrucibleResponseError &&
          isHubConflictCode(error.conflictCode)
            ? error.conflictCode
            : undefined,
        reauthenticationRequired:
          error instanceof CrucibleResponseError &&
          error.reauthenticationRequired,
        ...(error instanceof CrucibleResponseError && error.valueIssues
          ? {
              fieldErrors: Object.fromEntries(
                error.valueIssues.map((issue) => [
                  issue.field,
                  [valueIssueMessage(issue.kind)],
                ])
              ),
              message: `${valueIssueMessage(error.valueIssues[0].kind)} (${error.valueIssues[0].field})`,
            }
          : {}),
      }),
    }
  }
}

const valueIssueMessages: Record<ValueIssueKind, string> = {
  invalid_number: "A number is not a valid finite value.",
  unsupported_character: "A value contains a character Crucible cannot store.",
  current_password_required: "Enter your current password.",
  current_password_invalid: "That isn't your current password.",
  password_too_short:
    "Use a longer password. A few unrelated words make a strong password that is easy to remember.",
  password_too_long: "Use a shorter password.",
  password_common:
    "This password is commonly used, so it is easy to guess. Choose another one.",
  password_personal:
    "Don't use your username, email address, name or the name of this service as your password.",
}

function valueIssueMessage(kind: ValueIssueKind) {
  return valueIssueMessages[kind]
}
