import {
  useInspectorPane,
  useRememberedPreviewNavigation,
} from "@/components/crucible/inspector-pane"
import { ResourcePreviewContext } from "@/components/crucible/resource-preview-navigation"
import { useWindowClass } from "@/hooks/use-window-class"

import { ResourceInspector } from "./resource-inspector"

/**
 * The wide-screen preview pane: a fixed column beside the content that keeps
 * the last previewed resource while the current page shows none, with a hint
 * while it is empty.
 */
export function DockedPreviewPane() {
  const pane = useInspectorPane()
  const docked = useWindowClass() === "wide"
  const navigation = useRememberedPreviewNavigation()
  if (!pane) return null
  return (
    <>
      <div
        className="docked-preview-pane"
        data-open={pane.open ? "" : undefined}
      >
        {docked &&
        (pane.open || pane.motion === "hiding") &&
        !pane.hostShowsPreview &&
        !navigation ? (
          <p className="text-supporting text-muted-foreground">
            Preview items show here
          </p>
        ) : null}
      </div>
      {docked &&
      (pane.open || pane.motion === "hiding") &&
      !pane.hostShowsPreview &&
      navigation ? (
        <ResourcePreviewContext.Provider value={navigation}>
          <ResourceInspector navigation={navigation} />
        </ResourcePreviewContext.Provider>
      ) : null}
    </>
  )
}
