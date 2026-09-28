import {
  createCsrfMiddleware,
  createMiddleware,
  createServerOnlyFn,
  createStart,
} from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"

const hubAuth = createServerOnlyFn(
  () => import("./server/crucible/hub-auth.server")
)

const correlationMiddleware = createMiddleware().server(async ({ next }) => {
  const correlationId = crypto.randomUUID()
  setResponseHeader("X-Correlation-ID", correlationId)
  return next({ context: { correlationId } })
})
const csrfMiddleware = createCsrfMiddleware({
  filter: ({ request }) => !["GET", "HEAD", "OPTIONS"].includes(request.method),
  origin: async (origin, { request }) => {
    if (process.env.HUB_DATA_SOURCE === "hub-auth") {
      const { hubAuthPublicOrigin } = await hubAuth()
      return origin === hubAuthPublicOrigin()
    }
    return origin === new URL(request.url).origin
  },
})
const sessionMiddleware = createMiddleware().server(async ({ next }) => {
  const { withHubAuthRequest } = await hubAuth()
  return withHubAuthRequest(next)
})
const privateDocumentMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    if (
      process.env.HUB_DATA_SOURCE === "hub-auth" &&
      request.headers.get("accept")?.includes("text/html")
    ) {
      setResponseHeader("Cache-Control", "private, no-store")
    }
    return next()
  }
)

export const startInstance = createStart(() => ({
  requestMiddleware: [
    csrfMiddleware,
    correlationMiddleware,
    privateDocumentMiddleware,
    sessionMiddleware,
  ],
}))
