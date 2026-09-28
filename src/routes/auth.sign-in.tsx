import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import orcidIdUrl from "@/assets/orcid-id.svg"
import { AuthPage } from "@/components/crucible/auth-page"
import { Button } from "@/components/ui/button"

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
    <AuthPage
      title="Sign in to Crucible"
      description="Use your ORCID iD to access your projects and research data."
      footer={
        <>
          <span>New to ORCID?</span>
          <Button
            nativeButton={false}
            render={
              <a
                href="https://orcid.org"
                referrerPolicy="no-referrer"
                rel="noopener noreferrer"
              />
            }
            variant="link"
          >
            Learn more
          </Button>
        </>
      }
    >
      <Button
        className="w-full"
        nativeButton={false}
        render={<a href={loginUrl} />}
        size="lg"
      >
        <img
          alt=""
          aria-hidden="true"
          className="size-orcid-id-icon"
          src={orcidIdUrl}
        />
        Sign in with ORCID
      </Button>
    </AuthPage>
  )
}
