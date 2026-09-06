import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"

const correlationMiddleware = createMiddleware().server(async ({ next }) => {
  const correlationId = crypto.randomUUID()
  setResponseHeader("X-Correlation-ID", correlationId)
  return next({ context: { correlationId } })
})
const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === "serverFn",
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, correlationMiddleware],
}))
