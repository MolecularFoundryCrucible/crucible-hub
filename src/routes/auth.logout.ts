import { createFileRoute } from "@tanstack/react-router"

import { logoutHubSession } from "@/server/crucible/hub-auth.server"

export const Route = createFileRoute("/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin")
        if (origin !== new URL(request.url).origin) {
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
        return Response.redirect(new URL("/hub/", request.url), 303)
      },
    },
  },
})
