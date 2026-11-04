import { Fragment, useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"

import { KeyboardShortcutsIcon } from "@/components/crucible/icons"
import type { DialogHandle } from "@/components/ui/dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar"
import {
  isDialogKeyboardTarget,
  isEditableKeyboardTarget,
} from "@/lib/keyboard"

const navigationShortcuts = {
  d: "/data",
  h: "/",
  i: "/instruments",
  p: "/projects",
} as const

type Shortcut = {
  description: string
  keys: readonly string[]
  sequence?: boolean
}

type ShortcutGroup = { shortcuts: readonly Shortcut[]; title: string }

function goTo(key: string, description: string): Shortcut {
  return { description, keys: ["G", key], sequence: true }
}

type ResourceContext = {
  kind: "dataset" | "instrument" | "project" | "sample"
  mfid: string
}

/** Opens the Shortcuts dialog; on phones it closes the navigation drawer first. */
export function KeyboardShortcutsTrigger({ handle }: { handle: DialogHandle }) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <DialogTrigger
      handle={handle}
      onClick={() => {
        if (isMobile) setOpenMobile(false)
      }}
      render={
        <SidebarMenuButton
          aria-label="Keyboard shortcuts"
          tooltip="Keyboard shortcuts"
        />
      }
    >
      <KeyboardShortcutsIcon aria-hidden="true" />
      <span>Shortcuts</span>
    </DialogTrigger>
  )
}

export function KeyboardShortcuts({
  handle,
  pathname,
  projectActive,
}: {
  handle: DialogHandle
  pathname: string
  projectActive: boolean
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const sequenceStarted = useRef(false)
  const sequenceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  useEffect(() => {
    const resetSequence = () => {
      sequenceStarted.current = false
      if (sequenceTimer.current) clearTimeout(sequenceTimer.current)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        isEditableKeyboardTarget(event.target) ||
        isDialogKeyboardTarget(event.target)
      ) {
        return
      }

      if (
        event.key === "?" &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault()
        resetSequence()
        setOpen(true)
        return
      }

      if (event.altKey || event.ctrlKey || event.metaKey) {
        resetSequence()
        return
      }

      const key = event.key.toLocaleLowerCase()
      if (sequenceStarted.current) {
        resetSequence()
        if (navigateWithinResource(navigate, pathname, key)) {
          event.preventDefault()
          return
        }
        if (!Object.hasOwn(navigationShortcuts, key)) return
        const destination =
          navigationShortcuts[key as keyof typeof navigationShortcuts]
        event.preventDefault()
        void navigate({ to: destination })
        return
      }

      if (key === "g") {
        event.preventDefault()
        sequenceStarted.current = true
        sequenceTimer.current = setTimeout(resetSequence, 1_000)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      resetSequence()
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [navigate, pathname])

  return (
    <Dialog handle={handle} open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts are disabled while typing in a field.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {keyboardShortcutGroups(pathname, projectActive).map((group) => (
            <section
              aria-label={group.title}
              className="flex flex-col gap-2"
              key={group.title}
            >
              <h3 className="text-supporting text-muted-foreground">
                {group.title}
              </h3>
              <dl className="flex flex-col gap-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    className="grid grid-cols-3 items-center gap-4"
                    key={shortcut.description}
                  >
                    <dt>
                      <ShortcutKeys shortcut={shortcut} />
                    </dt>
                    <dd className="col-span-2">{shortcut.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ShortcutKeys({ shortcut }: { shortcut: Shortcut }) {
  return (
    <KbdGroup>
      {shortcut.keys.map((key, index) => (
        <Fragment key={`${index}-${key}`}>
          {shortcut.sequence && index > 0 ? (
            <span className="text-supporting text-muted-foreground">then</span>
          ) : null}
          <Kbd>{key}</Kbd>
        </Fragment>
      ))}
    </KbdGroup>
  )
}

export function keyboardShortcutGroups(
  pathname: string,
  projectActive: boolean
): ShortcutGroup[] {
  const context = getResourceContext(pathname)
  const processingUsesP = context?.kind === "dataset"
  const hasRecordSections =
    context?.kind === "dataset" || context?.kind === "sample"
  const onRecordOverview = /^\/(datasets|samples)\/[^/]+$/.test(pathname)
  const onGraph = /^\/(datasets|samples)\/[^/]+\/graph$/.test(pathname)

  const groups: ShortcutGroup[] = [
    {
      title: "General",
      shortcuts: [
        { description: "Search Crucible", keys: ["Ctrl K"] },
        ...(projectActive
          ? [{ description: "Search this project", keys: ["Ctrl Shift K"] }]
          : []),
        { description: "Expand or collapse navigation", keys: ["Ctrl B"] },
        { description: "Show keyboard shortcuts", keys: ["?"] },
        { description: "Close the active dialog or panel", keys: ["Esc"] },
      ],
    },
    {
      title: "Go to",
      shortcuts: [
        goTo("H", "Home"),
        goTo("D", "Data"),
        ...(processingUsesP ? [] : [goTo("P", "Projects")]),
        goTo("I", "Instruments"),
      ],
    },
  ]

  if (context) {
    groups.push({
      title: `This ${context.kind}`,
      shortcuts: [
        goTo("O", "Overview"),
        ...(processingUsesP ? [goTo("P", "Processing")] : []),
        ...(hasRecordSections ? [goTo("G", "Graph"), goTo("M", "Manage")] : []),
        ...(onRecordOverview
          ? [{ description: "Previous or next record", keys: ["←", "→"] }]
          : []),
        ...(onGraph
          ? [{ description: "Center the focused graph node", keys: ["F"] }]
          : []),
      ],
    })
  }
  return groups
}

function getResourceContext(pathname: string): ResourceContext | null {
  const match = pathname.match(
    /^\/(datasets|instruments|projects|samples)\/([^/]+)/
  )
  if (!match) return null

  const kind = match[1].slice(0, -1)
  const mfid = match[2]
  if (
    !mfid ||
    (kind !== "dataset" &&
      kind !== "instrument" &&
      kind !== "project" &&
      kind !== "sample")
  ) {
    return null
  }
  return { kind, mfid }
}

function navigateWithinResource(
  navigate: ReturnType<typeof useNavigate>,
  pathname: string,
  key: string
) {
  const context = getResourceContext(pathname)
  if (!context) return false

  if (key === "o") {
    if (context.kind === "project") {
      void navigate({
        params: { projectMfid: context.mfid },
        search: {},
        to: "/projects/$projectMfid/overview",
      })
    } else if (context.kind === "instrument") {
      void navigate({
        params: { instrumentMfid: context.mfid },
        search: {},
        to: "/instruments/$instrumentMfid",
      })
    } else if (context.kind === "sample") {
      void navigate({
        params: { sampleMfid: context.mfid },
        search: {},
        to: "/samples/$sampleMfid",
      })
    } else {
      void navigate({
        params: { datasetMfid: context.mfid },
        search: {},
        to: "/datasets/$datasetMfid",
      })
    }
    return true
  }

  if (context.kind !== "sample" && context.kind !== "dataset") return false
  if (key !== "g" && key !== "m" && key !== "p") return false
  if (key === "p" && context.kind !== "dataset") return false

  if (context.kind === "sample") {
    void navigate({
      params: { sampleMfid: context.mfid },
      search: {},
      to:
        key === "g"
          ? "/samples/$sampleMfid/graph"
          : "/samples/$sampleMfid/manage",
    })
  } else {
    void navigate({
      params: { datasetMfid: context.mfid },
      search: {},
      to:
        key === "g"
          ? "/datasets/$datasetMfid/graph"
          : key === "p"
            ? "/datasets/$datasetMfid/processing"
            : "/datasets/$datasetMfid/manage",
    })
  }
  return true
}
