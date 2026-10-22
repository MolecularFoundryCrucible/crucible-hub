import { useEffect, useState } from "react"

import { motionDuration } from "@/lib/motion"
import type { MotionToken } from "@/lib/motion"

/**
 * True once `active` has held for the delay (the indicator delay unless a
 * token or milliseconds are given); false as soon as it ends, so fast
 * operations never flash an indicator.
 */
export function useDelayedFlag(
  active: boolean,
  delay: MotionToken | number = "--motion-indicator-delay"
): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!active) {
      setShown(false)
      return
    }
    const timer = window.setTimeout(
      () => setShown(true),
      typeof delay === "number" ? delay : motionDuration(delay)
    )
    return () => window.clearTimeout(timer)
  }, [active, delay])
  return active && shown
}
