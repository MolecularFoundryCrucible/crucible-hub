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
        const signOutStatus = (await logoutHubSession())
          ? "complete"
          : "revocation-unconfirmed"
        const destination = new URL("/hub/auth/sign-in", publicOrigin)
        destination.searchParams.set("signedOut", signOutStatus)
        return new Response(null, {
          status: 303,
          headers: {
            Location: destination.toString(),
            "Cache-Control": "no-store",
          },
        })
      },
    },
  },
})
