import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"

import { KeyboardShortcutsIcon } from "@/components/crucible/icons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SidebarMenuButton } from "@/components/ui/sidebar"

const navigationShortcuts = {
  d: "/data",
  h: "/",
  i: "/instruments",
  p: "/projects",
} as const

const shortcuts = [
  ["Ctrl K", "Search Crucible"],
  ["Ctrl Shift K", "Search data in the current project"],
  ["G then H", "Go to Home"],
  ["G then P", "Go to Projects"],
  ["G then D", "Go to Data"],
  ["G then I", "Go to Instruments"],
  ["Ctrl B", "Expand or collapse navigation"],
  ["?", "Show keyboard shortcuts"],
  ["Esc", "Close the active dialog or panel"],
] as const

type ResourceContext = {
  kind: "dataset" | "instrument" | "project" | "sample"
  mfid: string
}

export function KeyboardShortcuts({
  pathname,
  projectActive,
}: {
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
      if (event.defaultPrevented || isEditableTarget(event.target)) return
      const target = event.target
      if (target instanceof Element && target.closest('[role="dialog"]')) return

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

  const resourceContext = getResourceContext(pathname)
  const contextualShortcuts = resourceContext
    ? [
        ["G then O", "Go to this resource's Overview"],
        ...(resourceContext.kind === "sample" ||
        resourceContext.kind === "dataset"
          ? [
              ["G then G", "Go to this resource's Graph"],
              ...(resourceContext.kind === "dataset"
                ? [["G then P", "Go to this dataset's Processing page"]]
                : []),
              ["G then M", "Go to this resource's Manage page"],
            ]
          : []),
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <SidebarMenuButton
            aria-label="Keyboard shortcuts"
            tooltip="Keyboard shortcuts"
            title="Keyboard shortcuts"
          />
        }
      >
        <KeyboardShortcutsIcon aria-hidden="true" />
        <span>Shortcuts</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts are disabled while typing in a field.
          </DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col gap-3">
          {shortcuts.map(([keys, description]) => {
            const unavailable = keys === "Ctrl Shift K" && !projectActive
            return (
              <div className="grid grid-cols-3 items-center gap-4" key={keys}>
                <dt>
                  <kbd className="rounded border bg-muted px-2 py-1 text-label-compact">
                    {keys}
                  </kbd>
                </dt>
                <dd
                  className={
                    unavailable
                      ? "col-span-2 text-muted-foreground"
                      : "col-span-2"
                  }
                >
                  {description}
                  {unavailable ? " (available inside a project)" : ""}
                </dd>
              </div>
            )
          })}
          {contextualShortcuts.map(([keys, description]) => (
            <div className="grid grid-cols-3 items-center gap-4" key={keys}>
              <dt>
                <kbd className="rounded border bg-muted px-2 py-1 text-label-compact">
                  {keys}
                </kbd>
              </dt>
              <dd className="col-span-2">{description}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
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

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.matches("input, select, textarea, [role='textbox']"))
  )
}
