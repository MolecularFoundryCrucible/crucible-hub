import { useCallback, useRef, useState } from "react"
import { useBlocker } from "@tanstack/react-router"

import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"

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
    <ConfirmationDialog
      cancelLabel="Keep editing"
      confirmLabel="Discard changes"
      description="Your edits have not been saved. Leaving this page will discard them."
      kind="alert"
      onConfirm={onDiscard}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onKeepEditing()
      }}
      open={open}
      title="Discard unsaved changes?"
      variant="destructive"
    />
  )
}
