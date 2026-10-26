import { createContext, useContext } from "react"

import type { ViewerPresentation } from "@/lib/viewer-presentation"

const defaultPresentation: ViewerPresentation = {
  inspectorOpen: true,
  sidebarOpen: true,
  theme: "system",
  timeZone: undefined,
  windowClass: "expanded",
}

const ViewerPresentationContext =
  createContext<ViewerPresentation>(defaultPresentation)

export const ViewerPresentationProvider = ViewerPresentationContext.Provider

export function useViewerPresentation() {
  return useContext(ViewerPresentationContext)
}
