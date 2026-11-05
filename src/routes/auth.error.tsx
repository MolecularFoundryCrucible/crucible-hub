import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { AuthPage } from "@/components/crucible/auth-page"
import { Button } from "@/components/ui/button"

const errors = {
  "account-mismatch": {
    title: "A different account signed in",
    description:
      "That sign-in was for a different account, so it was not used. You are still signed in as before. To continue, confirm with the account you are signed in with.",
    retry: false,
  },
  "stale-sign-in": {
    title: "Sign-in was not recent",
    description:
      "Confirming it's you needs a new sign-in, but an earlier one came back, so it was not used. You are still signed in as before. Try the action again to confirm.",
    retry: false,
  },
  unavailable: {
    title: "Sign-in is unavailable",
    description:
      "Crucible couldn't complete the sign-in right now. Try again in a few minutes. If you were already signed in, your session is unchanged.",
    retry: true,
  },
  default: {
    title: "Sign-in was not completed",
    description:
      "The sign-in was cancelled or expired. If you were already signed in, your session is unchanged.",
    retry: true,
  },
}

export const Route = createFileRoute("/auth/error")({
  validateSearch: z.object({
    reason: z
      .enum(["account-mismatch", "stale-sign-in", "unavailable"])
      .optional()
      .catch(undefined),
  }),
  component: SignInError,
})

function SignInError() {
  const { reason } = Route.useSearch()
  const { description, retry, title } = errors[reason ?? "default"]
  return (
    <AuthPage description={description} error title={title}>
      <div className="flex flex-col gap-2">
        {retry ? (
          <Button
            className="w-full"
            nativeButton={false}
            render={<a href="/hub/auth/sign-in" />}
            size="lg"
          >
            Try again
          </Button>
        ) : null}
        <Button
          className="w-full"
          nativeButton={false}
          render={<a href="/hub/" />}
          size="lg"
          variant={retry ? "outline" : "default"}
        >
          Return to Crucible Hub
        </Button>
      </div>
    </AuthPage>
  )
}
