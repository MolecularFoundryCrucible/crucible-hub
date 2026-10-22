import { useCallback, useRef, useState } from "react"

/**
 * Keeps lazily rendered overlay content mounted until its close animation
 * ends. Pass `onOpenChangeComplete` to the Base UI root.
 */
export function useExitSafeMount(open: boolean) {
  const [closedAfterExit, setClosedAfterExit] = useState(true)
  if (open && closedAfterExit) setClosedAfterExit(false)
  const onOpenChangeComplete = useCallback((isOpen: boolean) => {
    if (!isOpen) setClosedAfterExit(true)
  }, [])
  return { mounted: open || !closedAfterExit, onOpenChangeComplete }
}

/** The last non-empty value, so content survives while its overlay closes. */
export function useLastPresent<T>(value: T | null | undefined) {
  const last = useRef(value ?? undefined)
  if (value !== null && value !== undefined) last.current = value
  return last.current
}
