import { createFileRoute } from "@tanstack/react-router"

import { AuthPage } from "@/components/crucible/auth-page"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/auth/error")({
  component: SignInError,
})

function SignInError() {
  return (
    <AuthPage
      description="The ORCID sign-in was cancelled or expired. If you were already signed in, your session is unchanged."
      error
      title="Sign-in was not completed"
    >
      <div className="flex flex-col gap-2">
        <Button
          className="w-full"
          nativeButton={false}
          render={<a href="/hub/auth/sign-in" />}
          size="lg"
        >
          Try again
        </Button>
        <Button
          className="w-full"
          nativeButton={false}
          render={<a href="/hub/" />}
          size="lg"
          variant="outline"
        >
          Return to Crucible Hub
        </Button>
      </div>
    </AuthPage>
  )
}
