import { createFileRoute } from "@tanstack/react-router"
import { createServerOnlyFn } from "@tanstack/react-start"

const sessionStore = createServerOnlyFn(
  () => import("../server/crucible/hub-session-postgres.server")
)

const headers = { "Cache-Control": "no-store" }

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        if (process.env.HUB_AUTH_SESSION_MODE === "postgres") {
          try {
            const { checkPostgresSessionStore } = await sessionStore()
            await checkPostgresSessionStore()
          } catch {
            return Response.json(
              { status: "unavailable", sessions: "unavailable" },
              { headers, status: 503 }
            )
          }
          return Response.json({ status: "ok", sessions: "ok" }, { headers })
        }
        return Response.json({ status: "ok" }, { headers })
      },
    },
  },
})
