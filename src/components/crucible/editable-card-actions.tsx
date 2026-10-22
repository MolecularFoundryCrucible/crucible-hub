import {
  CancelChangesIcon,
  EditResourceIcon,
  SaveChangesIcon,
} from "@/components/crucible/icons"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { Button } from "@/components/ui/button"
import { CardFooter } from "@/components/ui/card"
import { useDelayedFlag } from "@/hooks/use-delayed-flag"
import { intentPreloadProps } from "@/lib/intent-preload"

export function EditableCardTrigger({
  label,
  onClick,
  onPreload,
}: {
  label: string
  onClick: () => void
  onPreload?: () => void
}) {
  const preload = onPreload ? intentPreloadProps(onPreload) : undefined
  return (
    <Button
      aria-label={label}
      onClick={onClick}
      {...preload}
      size="sm"
      type="button"
      variant="ghost"
    >
      <EditResourceIcon aria-hidden="true" data-icon="inline-start" />
      Edit
    </Button>
  )
}

export function EditableCardActions({
  canSubmit,
  dirty,
  formId,
  onCancel,
  pending,
  pendingLabel = "Saving",
  submitLabel = "Save",
}: {
  canSubmit: boolean
  dirty: boolean
  formId: string
  onCancel: () => void
  pending: boolean
  pendingLabel?: string
  submitLabel?: string
}) {
  const label = pending ? pendingLabel : submitLabel
  const disabled = !canSubmit || !dirty || pending

  const showPending = useDelayedFlag(pending)
  return (
    <CardFooter className="justify-end gap-2">
      <Button
        disabled={pending}
        onClick={onCancel}
        type="button"
        variant="outline"
      >
        <CancelChangesIcon aria-hidden="true" data-icon="inline-start" />
        Cancel
      </Button>
      <Button disabled={disabled} form={formId} type="submit">
        {showPending ? (
          <PendingIcon data-icon="inline-start" />
        ) : (
          <SaveChangesIcon aria-hidden="true" data-icon="inline-start" />
        )}
        {label}
      </Button>
    </CardFooter>
  )
}
