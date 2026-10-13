import { useCallback, useEffect, useRef } from "react"
import { useBlocker } from "@tanstack/react-router"

import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"

export function useUploadLeaveGuard(
  isActive: () => boolean,
  onLeave: () => void
) {
  const activeRef = useRef(isActive)
  activeRef.current = isActive
  const leaveRef = useRef(onLeave)
  leaveRef.current = onLeave
  const shouldBlock = useCallback(() => activeRef.current(), [])
  const blocker = useBlocker({
    enableBeforeUnload: shouldBlock,
    shouldBlockFn: shouldBlock,
    withResolver: true,
  })

  useEffect(() => () => leaveRef.current(), [])

  return {
    onLeave: () => {
      leaveRef.current()
      blocker.proceed?.()
    },
    onStay: () => blocker.reset?.(),
    open: blocker.status === "blocked",
  }
}

export function UploadLeaveDialog({
  onLeave,
  onStay,
  open,
}: {
  onLeave: () => void
  onStay: () => void
  open: boolean
}) {
  return (
    <ConfirmationDialog
      cancelLabel="Keep uploading"
      confirmLabel="Cancel upload and leave"
      description="Leaving this page cancels the active upload. Files that already finished stay attached."
      kind="alert"
      onConfirm={onLeave}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onStay()
      }}
      open={open}
      title="Cancel the upload?"
      variant="destructive"
    />
  )
}
