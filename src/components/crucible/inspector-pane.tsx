import { createContext, useContext, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"

import {
  HidePreviewPaneIcon,
  ShowPreviewPaneIcon,
} from "@/components/crucible/icons"
import type {
  ResourcePreviewIdentity,
  ResourcePreviewNavigation,
} from "@/components/crucible/resource-preview-navigation"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  inspectorCookie,
  writePresentationCookie,
} from "@/lib/viewer-presentation"

type RememberedPreview = {
  identity?: ResourcePreviewIdentity
  mfid: string
  previous?: readonly string[]
}

type PaneMemory = {
  current: RememberedPreview
  previous: readonly string[]
}

type InspectorPane = {
  forget: () => void
  hostShowsPreview: boolean
  memory: PaneMemory | null
  open: boolean
  openRemembered: (
    target: string,
    identity: ResourcePreviewIdentity | undefined,
    back: boolean
  ) => void
  registerHostPreview: () => () => void
  remember: (preview: RememberedPreview) => void
  setOpen: (open: boolean) => void
  trigger: React.RefObject<HTMLElement | null>
}

const InspectorPaneContext = createContext<InspectorPane | null>(null)

/**
 * The wide-screen preview pane: whether it is shown, and the last previewed
 * resource, which stays in the pane as people navigate until they close it.
 * Kept in memory only, like the Recent list.
 */
export function InspectorPaneProvider({
  children,
  initialOpen,
  resetKey,
}: {
  children: ReactNode
  initialOpen: boolean
  resetKey?: string
}) {
  const [open, setOpenState] = useState(initialOpen)
  const [memory, setMemory] = useState<PaneMemory | null>(null)
  const [memoryKey, setMemoryKey] = useState(resetKey)
  if (memoryKey !== resetKey) {
    setMemoryKey(resetKey)
    setMemory(null)
  }
  const [hostPreviews, setHostPreviews] = useState(0)
  const trigger = useRef<HTMLElement | null>(null)

  const actions = useMemo(
    () => ({
      forget: () => setMemory(null),
      openRemembered: (
        target: string,
        identity: ResourcePreviewIdentity | undefined,
        back: boolean
      ) =>
        setMemory((current) => {
          if (!current || current.current.mfid === target) return current
          return {
            current: { identity, mfid: target },
            previous: back
              ? current.previous.slice(0, -1)
              : [...current.previous, current.current.mfid].slice(-20),
          }
        }),
      registerHostPreview: () => {
        setHostPreviews((count) => count + 1)
        return () => setHostPreviews((count) => count - 1)
      },
      remember: ({ previous = [], ...preview }: RememberedPreview) =>
        setMemory((current) => {
          const same = current?.current.mfid === preview.mfid
          // While the router changes page, the old page reports its preview
          // once more without its trail; keep the trail already recorded.
          const trail = same && !previous.length ? current.previous : previous
          return same &&
            current.current.identity?.name === preview.identity?.name &&
            current.previous.join() === trail.join()
            ? current
            : { current: preview, previous: trail }
        }),
      setOpen: (next: boolean) => {
        setOpenState(next)
        writePresentationCookie(inspectorCookie, next ? "open" : "collapsed")
      },
    }),
    []
  )
  const value = useMemo<InspectorPane>(
    () => ({
      ...actions,
      hostShowsPreview: hostPreviews > 0,
      memory,
      open,
      trigger,
    }),
    [actions, hostPreviews, memory, open]
  )

  return (
    <InspectorPaneContext.Provider value={value}>
      {children}
    </InspectorPaneContext.Provider>
  )
}

export function useInspectorPane() {
  return useContext(InspectorPaneContext)
}

/** Navigation for the remembered preview: links update the pane, not the URL. */
export function useRememberedPreviewNavigation(): ResourcePreviewNavigation | null {
  const pane = useInspectorPane()
  const prepared = useRef<ResourcePreviewIdentity | undefined>(undefined)
  if (!pane?.memory) return null
  const { current, previous } = pane.memory

  return {
    close: pane.forget,
    host: { kind: "pane", preview: current.mfid },
    invalidPreview: false,
    open: (target, _source, identity, back = false) => {
      const known =
        identity ??
        (prepared.current?.mfid === target ? prepared.current : undefined)
      pane.openRemembered(target, known, back)
    },
    preparePreview: (identity) => {
      prepared.current = identity
    },
    preview: current.mfid,
    previewIdentity: current.identity,
    previous: previous.at(-1),
    replace: true,
    trail: previous,
    state: () => ({}),
    targetPreview: (target) => target,
    trigger: pane.trigger,
  }
}

/** Shows or hides the wide-screen preview pane; shown only on wide screens. */
export function InspectorPaneToggle() {
  const pane = useInspectorPane()
  if (!pane) return null
  const label = pane.open ? "Hide preview panel" : "Show preview panel"
  const Icon = pane.open ? HidePreviewPaneIcon : ShowPreviewPaneIcon
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={pane.open}
            className="hidden inspector:inline-flex"
            onClick={() => pane.setOpen(!pane.open)}
            size="icon"
            variant="ghost"
          />
        }
      >
        <Icon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
