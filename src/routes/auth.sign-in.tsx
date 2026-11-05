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
import { hubSignInChoices } from "@/data/crucible/hub-login-link"
import {
  getHubSessionSnapshot,
  getHubSignInOptions,
} from "@/data/crucible/session.functions"
import { announceHubSignOut } from "@/data/crucible/session-tabs"

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: z.object({
    returnTo: z.string().max(1024).optional().catch(undefined),
    signedOut: z
      .enum(["complete", "revocation-unconfirmed"])
      .optional()
      .catch(undefined),
  }),
  loader: () => getHubSignInOptions(),
  component: SignInPage,
})

function SignInPage() {
  const { returnTo, signedOut } = Route.useSearch()
  const { methods, origin } = Route.useLoaderData()
  useEffect(() => {
    if (!signedOut) return
    void getHubSessionSnapshot()
      .then((snapshot) => {
        if (!snapshot) announceHubSignOut()
      })
      .catch(() => undefined)
  }, [signedOut])

  const choices = hubSignInChoices(methods, origin, returnTo)
  const offersOrcid = methods?.some((method) => method.is_orcid) ?? false

  return (
    <AuthPage
      title="Sign in to Crucible"
      footer={
        offersOrcid ? (
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
        ) : null
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
        <div className="flex flex-col items-center gap-2">
          {choices.map((choice) => (
            <Button
              className={choices.length > 1 ? "w-full" : undefined}
              key={choice.href}
              nativeButton={false}
              render={<a href={choice.href} />}
              size="lg"
              variant="outline"
            >
              {choice.isOrcid ? (
                <img
                  alt=""
                  aria-hidden="true"
                  className="size-orcid-id-icon"
                  src={orcidIdUrl}
                />
              ) : null}
              {choice.label}
            </Button>
          ))}
        </div>
      </div>
    </AuthPage>
  )
}
