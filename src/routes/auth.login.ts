import { createFileRoute } from "@tanstack/react-router"

import { beginHubLogin } from "@/server/crucible/hub-auth.server"

export const Route = createFileRoute("/auth/login")({
  server: {
    handlers: {
      GET: ({ request }) => {
        try {
          const returnTo = new URL(request.url).searchParams.get("returnTo")
          return new Response(null, {
            status: 302,
            headers: {
              Location: beginHubLogin(returnTo),
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
            },
          })
        } catch {
          return new Response("Sign-in is unavailable.", {
            status: 503,
            headers: { "Cache-Control": "no-store" },
          })
        }
      },
    },
  },
})
