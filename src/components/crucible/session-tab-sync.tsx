import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { getHubSessionSnapshot } from "@/data/crucible/session.functions"
import { openHubSessionChannel } from "@/data/crucible/session-tabs"
import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"

export function SessionTabSync({
  accountMfid,
  privilegeMode,
}: {
  accountMfid: string
  privilegeMode: WorkspacePrivilegeMode
}) {
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    const leaveWorkspace = (destination = "/hub/auth/sign-in") => {
      queryClient.clear()
      window.location.replace(destination)
    }
    const checkSession = async () => {
      try {
        const snapshot = await getHubSessionSnapshot()
        if (!active) return
        if (!snapshot) leaveWorkspace()
        else if (
          snapshot.accountMfid !== accountMfid ||
          snapshot.privilegeMode !== privilegeMode
        )
          leaveWorkspace("/hub/")
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
  }, [accountMfid, privilegeMode, queryClient])

  return null
}
