import { createMiddleware, getGlobalStartContext } from "@tanstack/react-start"

export const queryCancellationMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next, signal }) => {
  const correlationId = getGlobalStartContext()?.correlationId

  if (!correlationId) {
    throw new Error("Request correlation context is unavailable.")
  }

  return next({ context: { correlationId, requestSignal: signal } })
})
