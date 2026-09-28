import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import orcidIdUrl from "@/assets/orcid-id.svg"
import { BrandMark } from "@/components/crucible/brand-mark"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: z.object({
    returnTo: z.string().max(1024).optional().catch(undefined),
  }),
  component: SignInPage,
})

function SignInPage() {
  const { returnTo } = Route.useSearch()
  const loginUrl = returnTo
    ? `/hub/auth/login?${new URLSearchParams({ returnTo })}`
    : "/hub/auth/login"

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-reading items-center justify-center p-page-gutter">
      <Card className="w-full max-w-state">
        <CardHeader>
          <BrandMark />
          <CardTitle>Sign in to Crucible</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-(--card-spacing)">
          <p className="text-muted-foreground">
            Crucible uses ORCID to connect your research identity to your
            account.
          </p>
          <Button nativeButton={false} render={<a href={loginUrl} />} size="lg">
            <img
              alt=""
              aria-hidden="true"
              className="size-orcid-id-icon"
              src={orcidIdUrl}
            />
            Sign in with ORCID
          </Button>
          <p className="text-label text-muted-foreground">
            New to ORCID?{" "}
            <a
              className="underline"
              href="https://orcid.org"
              referrerPolicy="no-referrer"
              rel="noopener noreferrer"
            >
              Learn more
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
