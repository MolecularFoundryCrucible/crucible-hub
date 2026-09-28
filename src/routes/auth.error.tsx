import { createFileRoute } from "@tanstack/react-router"

import { AuthPage } from "@/components/crucible/auth-page"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/auth/error")({
  component: SignInError,
})

function SignInError() {
  return (
    <AuthPage error title="Sign-in was not completed">
      <Button
        className="w-full"
        nativeButton={false}
        render={<a href="/hub/auth/sign-in" />}
        size="lg"
      >
        Try again
      </Button>
    </AuthPage>
  )
}
