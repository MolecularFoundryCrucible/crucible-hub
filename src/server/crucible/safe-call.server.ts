import "@tanstack/react-start/server-only"

import type { HubResult } from "@/data/crucible/result"

import { toHubApiError } from "./errors.server"
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
      }),
    }
  }
}
