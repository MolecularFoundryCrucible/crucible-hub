import { useEffect } from "react"

import orcidIdUrl from "@/assets/orcid-id.svg"
import { notifySuccess } from "@/components/crucible/notifications"
import { Button } from "@/components/ui/button"
import { HubApiClientError, hubErrorMessage } from "@/data/crucible/result"

const REAUTHENTICATED_HASH = "#reauthenticated"

export function reauthenticationRequired(error: unknown) {
  return (
    error instanceof HubApiClientError &&
    error.details.kind === "reauthentication-required"
  )
}

function reauthenticationHref() {
  const returnTo =
    typeof window === "undefined"
      ? "/hub/"
      : `${window.location.pathname}${window.location.search}${REAUTHENTICATED_HASH}`
  return `/hub/auth/login?${new URLSearchParams({ max_age: "0", returnTo })}`
}

function ReauthenticationPrompt() {
  return (
    <span className="flex flex-col items-start gap-2 text-foreground">
      <span>
        Issuing credentials needs a recent sign-in. Confirm it's you with ORCID;
        you'll return to this page to try again.
      </span>
      <Button
        nativeButton={false}
        render={<a href={reauthenticationHref()} />}
        size="sm"
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
    </span>
  )
}

export function hubActionError(
  error: unknown,
  fallback: string
): React.ReactNode {
  if (!reauthenticationRequired(error)) return hubErrorMessage(error, fallback)
  return <ReauthenticationPrompt />
}

export function useReauthenticationNotice() {
  useEffect(() => {
    if (window.location.hash !== REAUTHENTICATED_HASH) return
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`
    )
    notifySuccess("Signed in again", "You can retry the action now.")
  }, [])
}
