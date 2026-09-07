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
import { Button } from "@/components/ui/button"
import { sidebarMenuButtonVariants } from "@/components/ui/sidebar"

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

export function KeyboardShortcuts({
  projectActive,
}: {
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
  }, [navigate])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            aria-label="Keyboard shortcuts"
            className={sidebarMenuButtonVariants({
              className: "justify-start",
            })}
            data-sidebar="menu-button"
            title="Keyboard shortcuts"
            variant="ghost"
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
        </dl>
      </DialogContent>
    </Dialog>
  )
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.matches("input, select, textarea, [role='textbox']"))
  )
}
