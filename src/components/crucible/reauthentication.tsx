import { useEffect, useState } from "react"
import type { MouseEvent } from "react"

import { notifySuccess } from "@/components/crucible/notifications"
import { Button } from "@/components/ui/button"
import { HubApiClientError, hubErrorMessage } from "@/data/crucible/result"

const REAUTHENTICATED_HASH = "#reauthenticated"
export const REAUTHENTICATION_CHANNEL = "crucible-hub-reauthentication"

function reauthenticationRequired(error: unknown) {
  return (
    error instanceof HubApiClientError &&
    error.details.kind === "reauthentication-required"
  )
}

function reauthenticationHref(returnTo: string) {
  return `/hub/auth/login?${new URLSearchParams({ max_age: "0", returnTo })}`
}

function redirectReturnTo() {
  return typeof window === "undefined"
    ? "/hub/"
    : `${window.location.pathname}${window.location.search}${REAUTHENTICATED_HASH}`
}

function ReauthenticationPrompt({ reason }: { reason: string }) {
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    const channel = new BroadcastChannel(REAUTHENTICATION_CHANNEL)
    channel.onmessage = () => {
      setConfirmed(true)
      notifySuccess("Signed in again", "You can retry the action now.")
    }
    return () => channel.close()
  }, [])

  function openPopup(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const popup = window.open(
      reauthenticationHref("/hub/reauthenticated"),
      "crucible-hub-reauthentication",
      "popup,width=520,height=720"
    )
    if (popup) event.preventDefault()
  }

  if (confirmed) {
    return (
      <span className="text-foreground" role="status">
        Signed in again. Try the action again; what you entered is unchanged.
      </span>
    )
  }

  return (
    <span className="flex flex-col items-start gap-2 text-foreground">
      <span>
        {reason} Confirm it's you in a new window; what you entered here stays
        as it is.
      </span>
      <Button
        nativeButton={false}
        render={
          <a
            href={reauthenticationHref(redirectReturnTo())}
            onClick={openPopup}
          />
        }
        size="sm"
        variant="outline"
      >
        Sign in again
      </Button>
    </span>
  )
}

export function hubActionError(
  error: unknown,
  fallback: string,
  reason = "Issuing credentials needs a recent sign-in."
): React.ReactNode {
  if (!reauthenticationRequired(error)) return hubErrorMessage(error, fallback)
  return <ReauthenticationPrompt reason={reason} />
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
