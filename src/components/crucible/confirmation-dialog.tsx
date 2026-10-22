import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DelayedPendingIcon } from "@/components/crucible/pending-icon"

type ConfirmationProps = {
  cancelLabel?: string
  children?: React.ReactNode
  confirmDisabled?: boolean
  confirmLabel: string
  description: React.ReactNode
  error?: React.ReactNode
  kind?: "dialog" | "alert"
  onCancelPending?: () => void
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  onOpenChangeComplete?: (open: boolean) => void
  open: boolean
  pendingCancelDisabled?: boolean
  pendingCancelLabel?: string
  secondaryAction?: { label: string; onClick: () => void }
  title: React.ReactNode
  variant?: "default" | "destructive"
} & (
  | { pending?: undefined; pendingLabel?: undefined }
  | { pending: boolean; pendingLabel: string }
)

export function ConfirmationDialog({
  cancelLabel = "Cancel",
  children,
  confirmDisabled = false,
  confirmLabel,
  description,
  error,
  kind = "dialog",
  onCancelPending,
  onConfirm,
  onOpenChange,
  onOpenChangeComplete,
  open,
  pending = false,
  pendingCancelDisabled = false,
  pendingCancelLabel = "Stop",
  pendingLabel,
  secondaryAction,
  title,
  variant = "default",
}: ConfirmationProps) {
  const confirmVariant =
    variant === "destructive" ? "destructive-solid" : variant
  const secondary = secondaryAction ? (
    <Button
      disabled={pending}
      onClick={secondaryAction.onClick}
      type="button"
      variant="outline"
    >
      {secondaryAction.label}
    </Button>
  ) : null
  const activeCancelLabel =
    pending && onCancelPending ? pendingCancelLabel : cancelLabel
  const cancelDisabled = pending && (!onCancelPending || pendingCancelDisabled)
  if (kind === "alert") {
    return (
      <AlertDialog
        onOpenChange={(nextOpen) => {
          if (!pending) onOpenChange(nextOpen)
        }}
        onOpenChangeComplete={onOpenChangeComplete}
        open={open}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {children}
          <ConfirmationError>{error}</ConfirmationError>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={cancelDisabled}
              onClick={(event) => {
                if (!pending || !onCancelPending) return
                event.preventDefault()
                onCancelPending()
              }}
            >
              {activeCancelLabel}
            </AlertDialogCancel>
            {secondary}
            <AlertDialogAction
              disabled={pending || confirmDisabled}
              onClick={(event) => {
                event.preventDefault()
                onConfirm()
              }}
              variant={confirmVariant}
            >
              <DelayedPendingIcon
                data-icon="inline-start"
                pending={Boolean(pending)}
              />
              {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }
  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen)
      }}
      onOpenChangeComplete={onOpenChangeComplete}
      open={open}
    >
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <ConfirmationError>{error}</ConfirmationError>
        <DialogFooter>
          <Button
            disabled={cancelDisabled}
            onClick={() => {
              if (pending) onCancelPending?.()
              else onOpenChange(false)
            }}
            type="button"
            variant="outline"
          >
            {activeCancelLabel}
          </Button>
          {secondary}
          <Button
            disabled={pending || confirmDisabled}
            onClick={onConfirm}
            type="button"
            variant={confirmVariant}
          >
            <DelayedPendingIcon
              data-icon="inline-start"
              pending={Boolean(pending)}
            />
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmationError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return (
    <div className="text-body text-destructive" role="alert">
      {children}
    </div>
  )
}
