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
  confirmLabel: string
  description: React.ReactNode
  error?: React.ReactNode
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  pending?: boolean
  pendingLabel?: string
  title: React.ReactNode
  variant?: "default" | "destructive"
}

export function DismissibleConfirmationDialog({
  cancelLabel = "Cancel",
  confirmLabel,
  description,
  error,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
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
        <ConfirmationError>{error}</ConfirmationError>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {cancelLabel}
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
  confirmLabel,
  description,
  error,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
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
        <ConfirmationError>{error}</ConfirmationError>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
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
