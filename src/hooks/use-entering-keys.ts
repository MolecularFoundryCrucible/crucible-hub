import { useState } from "react"

import { enterMotionClassName } from "@/lib/motion"

const NONE: ReadonlySet<string> = new Set()

/**
 * Keys that arrived with the latest change to the key list; empty on the first
 * render. They stay entering through unrelated re-renders so an entrance
 * animation is not cut short.
 */
export function useEnteringKeys(keys: readonly string[]): ReadonlySet<string> {
  const signature = keys.join("\u0000")
  const [tracked, setTracked] = useState({ entering: NONE, signature })
  if (tracked.signature === signature) return tracked.entering

  const previous = new Set(
    tracked.signature ? tracked.signature.split("\u0000") : []
  )
  const entering = new Set(keys.filter((key) => !previous.has(key)))
  setTracked({ entering, signature })
  return entering
}

/** The content-enter class for items that arrived with the latest change. */
export function useEnteringClassName(keys: readonly string[]) {
  const entering = useEnteringKeys(keys)
  return (key: string) => (entering.has(key) ? enterMotionClassName : undefined)
}
