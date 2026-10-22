import { useCallback, useState } from "react"

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

/**
 * Keeps the subject of an overlay (a request, a preview, a credential) after
 * it is cleared, until the close animation ends, so the overlay never empties
 * while it leaves. Pass `onOpenChangeComplete` to the Base UI root.
 */
export function useExitSafeValue<T>(value: T | null | undefined) {
  const [kept, setKept] = useState(value ?? undefined)
  if (value != null && value !== kept) setKept(value)
  const onOpenChangeComplete = useCallback((isOpen: boolean) => {
    if (!isOpen) setKept(undefined)
  }, [])
  return { onOpenChangeComplete, value: value ?? kept }
}
