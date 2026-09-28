import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { getHubSessionIdentity } from "@/data/crucible/session.functions"
import { openHubSessionChannel } from "@/data/crucible/session-tabs"

export function SessionTabSync({ accountMfid }: { accountMfid: string }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    const leaveWorkspace = (destination = "/hub/auth/sign-in") => {
      queryClient.clear()
      window.location.replace(destination)
    }
    const checkSession = async () => {
      try {
        const identity = await getHubSessionIdentity()
        if (!active) return
        if (!identity) leaveWorkspace()
        else if (identity !== accountMfid) leaveWorkspace("/hub/")
      } catch {
        return
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkSession()
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void checkSession()
    }
    const channel = openHubSessionChannel()
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data === "sign-out") leaveWorkspace()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      active = false
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pageshow", onPageShow)
      channel?.close()
    }
  }, [accountMfid, queryClient])

  return null
}
