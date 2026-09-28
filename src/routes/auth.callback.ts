import { createFileRoute } from "@tanstack/react-router"

import {
  finishHubLogin,
  hubAuthPublicOrigin,
  hubSignInFailureDetails,
} from "@/server/crucible/hub-auth.server"

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get("code")
        const state = url.searchParams.get("state")
        const publicOrigin = hubAuthPublicOrigin()
        try {
          let destination: string
          if (code && state && code.length <= 512 && state.length <= 256) {
            destination = await finishHubLogin(code, state)
          } else {
            throw new Error("Invalid sign-in response.")
          }
          return new Response(null, {
            status: 303,
            headers: {
              Location: new URL(destination, publicOrigin).toString(),
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
            },
          })
        } catch (error) {
          console.error(
            "[Crucible Hub] Sign-in callback failed",
            hubSignInFailureDetails(error)
          )
          return new Response(null, {
            status: 303,
            headers: {
              Location: new URL("/hub/auth/error", publicOrigin).toString(),
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
            },
          })
        }
      },
    },
  },
})
