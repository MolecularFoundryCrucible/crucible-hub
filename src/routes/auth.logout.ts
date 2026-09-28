import { createFileRoute } from "@tanstack/react-router"

import {
  hubAuthPublicOrigin,
  logoutHubSession,
} from "@/server/crucible/hub-auth.server"

export const Route = createFileRoute("/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin")
        const publicOrigin = hubAuthPublicOrigin()
        if (origin !== publicOrigin) {
          return new Response("Forbidden", { status: 403 })
        }
        try {
          await logoutHubSession()
        } catch {
          return new Response(
            "Signed out locally. API revocation could not be confirmed.",
            {
              status: 502,
              headers: { "Cache-Control": "no-store" },
            }
          )
        }
        return new Response(null, {
          status: 303,
          headers: {
            Location: new URL("/hub/", publicOrigin).toString(),
            "Cache-Control": "no-store",
          },
        })
      },
    },
  },
})
