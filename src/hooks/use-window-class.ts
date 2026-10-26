import { useSyncExternalStore } from "react"

import { useViewerPresentation } from "@/hooks/use-viewer-presentation"
import {
  windowClassBreakpoints,
  windowClassForMatches,
} from "@/lib/window-class"
import type { WindowClass } from "@/lib/window-class"

const queries = {
  expanded: `(width >= ${windowClassBreakpoints.expanded})`,
  medium: `(width >= ${windowClassBreakpoints.medium})`,
  wide: `(width >= ${windowClassBreakpoints.wide})`,
}

function subscribe(onChange: () => void) {
  const lists = Object.values(queries).map((query) => window.matchMedia(query))
  for (const list of lists) list.addEventListener("change", onChange)
  return () => {
    for (const list of lists) list.removeEventListener("change", onChange)
  }
}

function snapshot(): WindowClass {
  return windowClassForMatches({
    expanded: window.matchMedia(queries.expanded).matches,
    medium: window.matchMedia(queries.medium).matches,
    wide: window.matchMedia(queries.wide).matches,
  })
}

/**
 * The current window class. The server renders with the class the browser
 * last reported in the window class cookie.
 */
export function useWindowClass(): WindowClass {
  const { windowClass } = useViewerPresentation()
  return useSyncExternalStore(subscribe, snapshot, () => windowClass)
}
