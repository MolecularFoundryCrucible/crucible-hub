import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { AuthPage } from "@/components/crucible/auth-page"
import { Button } from "@/components/ui/button"
import { hubPageTitle } from "@/lib/page-title"

const fileUnavailableSearchSchema = z.object({
  reason: z.string().max(64).optional().catch(undefined),
})

const descriptions: Record<string, string> = {
  unavailable:
    "This file is not available from Crucible storage. It may be catalogued elsewhere or its stored copy may no longer be valid.",
  "not-found": "This file could not be found.",
  forbidden: "You do not have permission to open this file.",
  unauthenticated: "Sign in to open this file.",
  "reauthentication-required": "Sign in again to open this file.",
}

export const Route = createFileRoute("/files/unavailable")({
  validateSearch: fileUnavailableSearchSchema,
  head: () => ({ meta: [{ title: hubPageTitle("File unavailable") }] }),
  component: FileUnavailable,
})

function FileUnavailable() {
  const { reason } = Route.useSearch()
  const signIn =
    reason === "unauthenticated" || reason === "reauthentication-required"
  return (
    <AuthPage
      description={
        (reason && descriptions[reason]) ??
        "Crucible could not prepare this file. Try again shortly."
      }
      error
      title={signIn ? "Sign in to open this file" : "File unavailable"}
    >
      <div className="flex flex-col gap-2">
        {signIn ? (
          <Button
            className="w-full"
            nativeButton={false}
            render={<a href="/hub/auth/sign-in" />}
            size="lg"
          >
            Sign in
          </Button>
        ) : null}
        <Button
          className="w-full"
          nativeButton={false}
          render={<a href="/hub/" />}
          size="lg"
          variant={signIn ? "outline" : "default"}
        >
          Return to Crucible Hub
        </Button>
      </div>
    </AuthPage>
  )
}
