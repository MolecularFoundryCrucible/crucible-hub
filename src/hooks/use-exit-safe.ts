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
