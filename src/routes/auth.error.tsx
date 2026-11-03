import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { AuthPage } from "@/components/crucible/auth-page"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/auth/error")({
  validateSearch: z.object({
    reason: z.enum(["account-mismatch"]).optional().catch(undefined),
  }),
  component: SignInError,
})

function SignInError() {
  const { reason } = Route.useSearch()
  const accountMismatch = reason === "account-mismatch"
  return (
    <AuthPage
      description={
        accountMismatch
          ? "That sign-in was for a different account, so it was not used. You are still signed in as before. To continue, confirm with the account you are signed in with."
          : "The ORCID sign-in was cancelled or expired. If you were already signed in, your session is unchanged."
      }
      error
      title={
        accountMismatch
          ? "A different account signed in"
          : "Sign-in was not completed"
      }
    >
      <div className="flex flex-col gap-2">
        {accountMismatch ? null : (
          <Button
            className="w-full"
            nativeButton={false}
            render={<a href="/hub/auth/sign-in" />}
            size="lg"
          >
            Try again
          </Button>
        )}
        <Button
          className="w-full"
          nativeButton={false}
          render={<a href="/hub/" />}
          size="lg"
          variant={accountMismatch ? "default" : "outline"}
        >
          Return to Crucible Hub
        </Button>
      </div>
    </AuthPage>
  )
}
