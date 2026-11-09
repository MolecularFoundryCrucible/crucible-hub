import { createFileRoute } from "@tanstack/react-router"

import {
  finishHubLogin,
  hubAuthPublicOrigin,
  hubSignInErrorReason,
  hubSignInFailureDetails,
} from "@/server/crucible/hub-auth.server"

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get("code")
        const state = url.searchParams.get("state")
        const providerError = url.searchParams.get("error")
        const issuer = url.searchParams.get("iss")
        const publicOrigin = hubAuthPublicOrigin()
        try {
          let destination: string
          if (state && state.length <= 256 && providerError !== null) {
            destination = await finishHubLogin(
              null,
              state,
              providerError.slice(0, 64),
              issuer
            )
          } else if (
            code &&
            state &&
            code.length <= 512 &&
            state.length <= 256
          ) {
            destination = await finishHubLogin(code, state, null, issuer)
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
          const details = hubSignInFailureDetails(error)
          console.error("[Crucible Hub] Sign-in callback failed", details)
          const reason = hubSignInErrorReason(details)
          const errorPage = reason
            ? `/hub/auth/error?reason=${reason}`
            : "/hub/auth/error"
          return new Response(null, {
            status: 303,
            headers: {
              Location: new URL(errorPage, publicOrigin).toString(),
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
            },
          })
        }
      },
    },
  },
})
