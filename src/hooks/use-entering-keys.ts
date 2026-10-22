import { useEffect, useRef } from "react"

/** Keys that appeared since the previous commit; empty on the first render. */
export function useEnteringKeys(keys: readonly string[]): ReadonlySet<string> {
  const seen = useRef<ReadonlySet<string> | null>(null)
  const previous = seen.current
  const entering = new Set(
    previous ? keys.filter((key) => !previous.has(key)) : []
  )
  const signature = keys.join("\u0000")
  useEffect(() => {
    seen.current = new Set(signature ? signature.split("\u0000") : [])
  }, [signature])
  return entering
}
