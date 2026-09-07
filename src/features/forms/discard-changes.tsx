import { useCallback, useRef, useState } from "react"
import { useBlocker } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function useDiscardProtection(
  isDirty: boolean | (() => boolean),
  onDiscard: () => void,
  cancelNavigates = false
) {
  const dirty = useRef(isDirty)
  dirty.current = isDirty
  const [cancelRequested, setCancelRequested] = useState(false)
  const shouldBlock = useCallback(
    () =>
      typeof dirty.current === "function" ? dirty.current() : dirty.current,
    []
  )
  const blocker = useBlocker({
    enableBeforeUnload: shouldBlock,
    shouldBlockFn: shouldBlock,
    withResolver: true,
  })

  return {
    dialog: {
      onDiscard: () => {
        if (cancelRequested) {
          setCancelRequested(false)
          onDiscard()
          return
        }
        blocker.proceed?.()
      },
      onKeepEditing: () => {
        setCancelRequested(false)
        blocker.reset?.()
      },
      open: cancelRequested || blocker.status === "blocked",
    },
    requestCancel: () => {
      if (cancelNavigates) {
        onDiscard()
        return
      }
      if (shouldBlock()) {
        setCancelRequested(true)
        return
      }
      onDiscard()
    },
  }
}

export function DiscardChangesDialog({
  onDiscard,
  onKeepEditing,
  open,
}: {
  onDiscard: () => void
  onKeepEditing: () => void
  open: boolean
}) {
  return (
    <Dialog
      onOpenChange={(nextOpen) => !nextOpen && onKeepEditing()}
      open={open}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogDescription>
            Your edits have not been saved. Leaving this page will discard them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onKeepEditing} variant="outline">
            Keep editing
          </Button>
          <Button onClick={onDiscard} variant="destructive">
            Discard changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
