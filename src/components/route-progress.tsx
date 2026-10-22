import { useRouterState } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"

import { useDelayedFlag } from "@/hooks/use-delayed-flag"
import { motionDuration } from "@/lib/motion"

type Phase = "active" | "done" | "idle"

export function RouteProgress() {
  const loading = useRouterState({
    select: (state) => state.status === "pending",
  })
  const shown = useDelayedFlag(loading)
  const [phase, setPhase] = useState<Phase>("idle")
  const wasShown = useRef(false)

  useEffect(() => {
    if (shown) {
      wasShown.current = true
      setPhase("active")
      return
    }
    if (!wasShown.current) return
    wasShown.current = false
    setPhase("done")
    const timer = window.setTimeout(
      () => setPhase("idle"),
      motionDuration("--motion-fast") * 2
    )
    return () => window.clearTimeout(timer)
  }, [shown])

  return (
    <div aria-hidden="true" className="route-progress" data-phase={phase} />
  )
}
