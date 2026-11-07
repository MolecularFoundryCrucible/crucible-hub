import { useEffect, useRef, useState } from "react"
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

function openReauthenticationPopup() {
  return window.open(
    reauthenticationHref("/hub/reauthenticated"),
    "crucible-hub-reauthentication",
    "popup,width=520,height=720"
  )
}

const popupClosedGraceMs = 500

function confirmInPopup(): Promise<boolean> {
  const popup = openReauthenticationPopup()
  if (!popup) return Promise.resolve(false)
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(REAUTHENTICATION_CHANNEL)
    let closedAt: number | null = null
    const finish = (confirmed: boolean) => {
      window.clearInterval(watch)
      channel.close()
      resolve(confirmed)
    }
    channel.onmessage = () => finish(true)
    const watch = window.setInterval(() => {
      if (!popup.closed) return
      closedAt ??= Date.now()
      if (Date.now() - closedAt >= popupClosedGraceMs) finish(false)
    }, 250)
  })
}

export async function withReauthentication<T>(
  attempt: () => Promise<T>
): Promise<T> {
  try {
    return await attempt()
  } catch (error) {
    if (!reauthenticationRequired(error) || !(await confirmInPopup())) {
      throw error
    }
    return attempt()
  }
}

function ReauthenticationPrompt({
  reason,
  retry,
}: {
  reason: string
  retry?: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  const opened = useRef(false)

  useEffect(() => {
    const channel = new BroadcastChannel(REAUTHENTICATION_CHANNEL)
    channel.onmessage = () => {
      if (!opened.current) return
      opened.current = false
      if (retry) {
        retry()
        return
      }
      setConfirmed(true)
      notifySuccess("Signed in again", "You can retry the action now.")
    }
    return () => channel.close()
  }, [retry])

  function openPopup(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (!openReauthenticationPopup()) return
    opened.current = true
    event.preventDefault()
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
  reason = "Issuing credentials needs a recent sign-in.",
  retry?: () => void
): React.ReactNode {
  if (!reauthenticationRequired(error)) return hubErrorMessage(error, fallback)
  return <ReauthenticationPrompt reason={reason} retry={retry} />
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
