import { createFileRoute } from "@tanstack/react-router"

import { hubAuthPublicOrigin } from "@/server/crucible/hub-auth.server"
import { finishHubLinkCallback } from "@/server/crucible/hub-link.server"
import type { HubLinkCallbackOutcome } from "@/server/crucible/hub-link.server"

function bounded(value: string | null, limit: number) {
  return value !== null && value.length <= limit ? value : null
}

export const Route = createFileRoute("/auth/link/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        let outcome: HubLinkCallbackOutcome
        try {
          outcome = await finishHubLinkCallback({
            code: bounded(url.searchParams.get("code"), 512),
            error: url.searchParams.has("error")
              ? (bounded(url.searchParams.get("error"), 64) ?? "other")
              : null,
            iss: url.searchParams.get("iss"),
            state: bounded(url.searchParams.get("state"), 256),
          })
        } catch (error) {
          console.error("[Crucible Hub] Sign-in link callback failed", {
            reason: error instanceof Error ? error.name : "unexpected",
          })
          outcome = "failed"
        }
        if (outcome !== "pending") {
          console.warn("[Crucible Hub] Sign-in link not completed", {
            outcome,
          })
        }
        const destination =
          outcome === "signed-out"
            ? "/hub/auth/sign-in?returnTo=%2Fhub%2Faccount"
            : `/hub/account?link=${outcome}`
        return new Response(null, {
          status: 303,
          headers: {
            Location: new URL(destination, hubAuthPublicOrigin()).toString(),
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        })
      },
    },
  },
})
