import { SavingChangesIcon } from "@/components/crucible/icons"
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

type ConfirmationProps = {
  cancelLabel?: string
  children?: React.ReactNode
  confirmLabel: string
  description: React.ReactNode
  error?: React.ReactNode
  onCancelPending?: () => void
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  pending?: boolean
  pendingCancelDisabled?: boolean
  pendingCancelLabel?: string
  pendingLabel?: string
  title: React.ReactNode
  variant?: "default" | "destructive"
}

export function DismissibleConfirmationDialog({
  cancelLabel = "Cancel",
  children,
  confirmLabel,
  description,
  error,
  onCancelPending,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  pendingCancelDisabled = false,
  pendingCancelLabel = "Stop",
  pendingLabel,
  title,
  variant = "default",
}: ConfirmationProps) {
  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen)
      }}
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
            disabled={pending && (!onCancelPending || pendingCancelDisabled)}
            onClick={() => {
              if (pending) onCancelPending?.()
              else onOpenChange(false)
            }}
            type="button"
            variant="outline"
          >
            {pending && onCancelPending ? pendingCancelLabel : cancelLabel}
          </Button>
          <Button
            disabled={pending}
            onClick={onConfirm}
            type="button"
            variant={variant}
          >
            {pending ? <ConfirmationPendingIcon /> : null}
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ConfirmationAlertDialog({
  cancelLabel = "Cancel",
  children,
  confirmLabel,
  description,
  error,
  onCancelPending,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  pendingCancelDisabled = false,
  pendingCancelLabel = "Stop",
  pendingLabel,
  title,
  variant = "default",
}: ConfirmationProps) {
  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen)
      }}
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
            disabled={pending && (!onCancelPending || pendingCancelDisabled)}
            onClick={(event) => {
              if (!pending || !onCancelPending) return
              event.preventDefault()
              onCancelPending()
            }}
          >
            {pending && onCancelPending ? pendingCancelLabel : cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
            variant={variant}
          >
            {pending ? <ConfirmationPendingIcon /> : null}
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

function ConfirmationPendingIcon() {
  return (
    <SavingChangesIcon
      aria-hidden="true"
      className="motion-safe:animate-spin"
      data-icon="inline-start"
    />
  )
}
