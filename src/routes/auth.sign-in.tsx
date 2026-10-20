import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { z } from "zod"

import orcidIdUrl from "@/assets/orcid-id.svg"
import { AuthPage } from "@/components/crucible/auth-page"
import {
  SignOutSuccessIcon,
  SignOutWarningIcon,
} from "@/components/crucible/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getHubSessionSnapshot } from "@/data/crucible/session.functions"
import { announceHubSignOut } from "@/data/crucible/session-tabs"

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: z.object({
    returnTo: z.string().max(1024).optional().catch(undefined),
    signedOut: z
      .enum(["complete", "revocation-unconfirmed"])
      .optional()
      .catch(undefined),
  }),
  component: SignInPage,
})

function SignInPage() {
  const { returnTo, signedOut } = Route.useSearch()
  useEffect(() => {
    if (!signedOut) return
    void getHubSessionSnapshot()
      .then((snapshot) => {
        if (!snapshot) announceHubSignOut()
      })
      .catch(() => undefined)
  }, [signedOut])
  const loginUrl = returnTo
    ? `/hub/auth/login?${new URLSearchParams({ returnTo })}`
    : "/hub/auth/login"

  return (
    <AuthPage
      title="Sign in to Crucible"
      footer={
        <>
          <span>
            {signedOut
              ? "Your ORCID session may still be active."
              : "New to ORCID?"}
          </span>
          <Button
            nativeButton={false}
            render={
              <a
                href="https://orcid.org"
                referrerPolicy="no-referrer"
                rel="noopener noreferrer"
              />
            }
            size="sm"
            variant="ghost"
          >
            {signedOut ? "Open ORCID" : "Learn more"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-auth-brand-gap">
        {signedOut === "complete" ? (
          <Badge
            className="max-w-full whitespace-normal"
            role="status"
            variant="success"
          >
            <SignOutSuccessIcon aria-hidden="true" />
            You've signed out.
          </Badge>
        ) : signedOut === "revocation-unconfirmed" ? (
          <Badge
            className="max-w-full whitespace-normal"
            role="status"
            variant="warning"
          >
            <SignOutWarningIcon aria-hidden="true" />
            Signed out here. API revocation could not be confirmed.
          </Badge>
        ) : null}
        <Button
          className="self-center"
          nativeButton={false}
          render={<a href={loginUrl} />}
          size="lg"
          variant="outline"
        >
          <img
            alt=""
            aria-hidden="true"
            className="size-orcid-id-icon"
            src={orcidIdUrl}
          />
          Sign in with ORCID
        </Button>
      </div>
    </AuthPage>
  )
}
