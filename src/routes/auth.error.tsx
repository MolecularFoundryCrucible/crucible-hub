import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/auth/error")({
  component: SignInError,
})

function SignInError() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-reading items-center justify-center p-page-gutter">
      <Card className="w-full max-w-state">
        <CardHeader>
          <CardTitle>Sign-in was not completed</CardTitle>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} render={<a href="/hub/auth/sign-in" />}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
