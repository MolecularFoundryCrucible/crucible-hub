import { useEffect, useId } from "react"
import type { ErrorComponentProps } from "@tanstack/react-router"

import { HubApiClientError } from "@/data/crucible/result"

export function useRouteErrorReport({
  error,
  info,
  scope,
}: Pick<ErrorComponentProps, "error" | "info"> & { scope: string }) {
  const localId = useId().replaceAll(":", "")
  const reference =
    error instanceof HubApiClientError
      ? error.details.correlationId
      : `client-${localId}`
  const message =
    error instanceof HubApiClientError
      ? error.details.message
      : "An unexpected interface error occurred."

  useEffect(() => {
    const diagnostic = {
      componentStack: info?.componentStack,
      errorMessage:
        error instanceof Error
          ? sanitizedDiagnosticMessage(error.message)
          : "A non-Error value was thrown.",
      errorName: error instanceof Error ? error.name : "UnknownError",
      reference,
      scope,
    }
    console.error("[Crucible Hub] Route error", diagnostic)
  }, [error, info?.componentStack, reference, scope])

  return { message, reference }
}

function sanitizedDiagnosticMessage(message: string) {
  return message
    .replaceAll(/https?:\/\/\S+/gi, "[url]")
    .replaceAll(
      /(authorization|api[_-]?key|cookie|token)\s*[:=]\s*\S+/gi,
      "$1=[redacted]"
    )
    .slice(0, 500)
}
