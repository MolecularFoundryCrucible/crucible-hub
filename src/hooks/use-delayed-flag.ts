import { useEffect, useState } from "react"

import { motionDuration } from "@/lib/motion"

/**
 * True once `active` has held for the indicator delay; false as soon as it
 * ends, so fast operations never flash an indicator.
 */
export function useDelayedFlag(active: boolean, delayMs?: number): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!active) {
      setShown(false)
      return
    }
    const timer = window.setTimeout(
      () => setShown(true),
      delayMs ?? motionDuration("--motion-indicator-delay")
    )
    return () => window.clearTimeout(timer)
  }, [active, delayMs])
  return active && shown
}
