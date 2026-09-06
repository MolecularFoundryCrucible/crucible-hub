import "@tanstack/react-start/server-only"

import type { HubResult } from "@/data/crucible/result"

import { toHubApiError } from "./errors.server"
import { CrucibleResponseError } from "./request-error.server"

export async function safeCrucibleCall<T>(
  correlationId: string,
  operation: () => Promise<T>
): Promise<HubResult<T>> {
  try {
    return { status: "ok", data: await operation() }
  } catch (error) {
    return {
      status: "error",
      error: toHubApiError({
        correlationId,
        status:
          error instanceof CrucibleResponseError ? error.status : undefined,
        cancelled: error instanceof DOMException && error.name === "AbortError",
        timedOut:
          error instanceof DOMException && error.name === "TimeoutError",
      }),
    }
  }
}
