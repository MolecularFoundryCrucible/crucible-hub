import {
  useInspectorPane,
  useRememberedPreviewNavigation,
} from "@/components/crucible/inspector-pane"
import { ResourcePreviewContext } from "@/components/crucible/resource-preview-navigation"
import { useMediaQuery } from "@/hooks/use-media-query"

import { ResourceInspector } from "./resource-inspector"

/**
 * The wide-screen preview pane: a fixed column beside the content that keeps
 * the last previewed resource while the current page shows none.
 */
export function DockedPreviewPane() {
  const pane = useInspectorPane()
  const docked = useMediaQuery("(min-width: 90rem)")
  const navigation = useRememberedPreviewNavigation()
  if (!pane) return null
  return (
    <>
      <div
        aria-hidden="true"
        className="docked-preview-pane"
        data-open={pane.open ? "" : undefined}
      />
      {docked && pane.open && !pane.hostShowsPreview && navigation ? (
        <ResourcePreviewContext.Provider value={navigation}>
          <ResourceInspector navigation={navigation} />
        </ResourcePreviewContext.Provider>
      ) : null}
    </>
  )
}
