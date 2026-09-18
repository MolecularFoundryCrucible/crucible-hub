import { useEffect, useId, useRef } from "react"
import type { ErrorComponentProps } from "@tanstack/react-router"

import { HubApiClientError } from "@/data/crucible/result"

export function useRouteErrorReport({
  error,
  info,
  scope,
}: Pick<ErrorComponentProps, "error" | "info"> & { scope: string }) {
  const reportedError = useRef<unknown>(undefined)
  const localId = useId().replaceAll(":", "")
  const reference =
    error instanceof HubApiClientError
      ? error.details.correlationId
      : `client-${localId}`
  const message =
    error instanceof HubApiClientError
      ? error.details.message
      : "An unexpected interface error occurred."
  const reloadRequired = isModuleLoadError(error)

  useEffect(() => {
    if (reportedError.current === error) return
    reportedError.current = error
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

  return { message, reference, reloadRequired }
}

function isModuleLoadError(error: unknown) {
  return (
    error instanceof TypeError &&
    /(dynamically imported module|module script)/i.test(error.message)
  )
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
