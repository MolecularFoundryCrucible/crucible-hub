import { createFileRoute } from "@tanstack/react-router"

import {
  beginHubLogin,
  enforceHubLoginRateLimit,
  HubLoginRateLimitError,
} from "@/server/crucible/hub-auth.server"

export const Route = createFileRoute("/auth/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          enforceHubLoginRateLimit()
          const search = new URL(request.url).searchParams
          const maxAge = search.get("max_age")
          const provider = search.get("provider")
          return new Response(null, {
            status: 302,
            headers: {
              Location: await beginHubLogin(
                search.get("returnTo"),
                maxAge !== null &&
                  /^\d{1,5}$/.test(maxAge) &&
                  Number(maxAge) <= 86_400
                  ? Number(maxAge)
                  : null,
                provider !== null && /^[A-Za-z0-9_.-]{1,64}$/.test(provider)
                  ? provider
                  : null
              ),
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
            },
          })
        } catch (error) {
          if (error instanceof HubLoginRateLimitError) {
            return new Response(
              "Too many sign-in requests. Try again shortly.",
              {
                status: 429,
                headers: { "Cache-Control": "no-store" },
              }
            )
          }
          return new Response("Sign-in is unavailable.", {
            status: 503,
            headers: { "Cache-Control": "no-store" },
          })
        }
      },
    },
  },
})
