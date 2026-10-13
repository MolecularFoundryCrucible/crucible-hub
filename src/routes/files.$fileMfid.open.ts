import { createFileRoute } from "@tanstack/react-router"

import { fixtureScenarioSchema } from "@/data/crucible/fixture-scenarios"
import { createWorkspaceFileDownload } from "@/data/crucible/resources.server"
import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

const fileMfidPattern = /^[a-zA-Z0-9_-]{1,255}$/

function fileUnavailable(reason: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/hub/files/unavailable?reason=${encodeURIComponent(reason)}`,
      "Cache-Control": "no-store",
    },
  })
}

export const Route = createFileRoute("/files/$fileMfid/open")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!fileMfidPattern.test(params.fileMfid))
          return fileUnavailable("not-found")
        const scenario = fixtureScenarioSchema.safeParse(
          new URL(request.url).searchParams.get("scenario")
        )
        const result = await safeCrucibleCall(
          crypto.randomUUID(),
          () =>
            createWorkspaceFileDownload(
              params.fileMfid,
              scenario.success ? scenario.data : undefined,
              request.signal,
              "inline"
            ),
          { operation: "file-open" }
        )
        if (result.status === "error") return fileUnavailable(result.error.kind)
        if (result.data.status === "unavailable")
          return fileUnavailable("unavailable")
        return new Response(null, {
          status: 302,
          headers: {
            Location: result.data.url,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        })
      },
    },
  },
})
