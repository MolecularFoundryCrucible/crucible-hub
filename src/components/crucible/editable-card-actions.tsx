import {
  CancelChangesIcon,
  EditResourceIcon,
  SaveChangesIcon,
} from "@/components/crucible/icons"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { Button } from "@/components/ui/button"
import { CardFooter } from "@/components/ui/card"
import { intentPreloadProps } from "@/lib/intent-preload"

export function EditableCardTrigger({
  compact = false,
  label,
  onClick,
  onPreload,
}: {
  compact?: boolean
  label: string
  onClick: () => void
  onPreload?: () => void
}) {
  const preload = onPreload ? intentPreloadProps(onPreload) : undefined
  return (
    <Button
      aria-label={compact ? label : undefined}
      onClick={onClick}
      {...preload}
      size="sm"
      type="button"
      variant="outline"
    >
      <EditResourceIcon aria-hidden="true" data-icon="inline-start" />
      {compact ? "Edit" : label}
    </Button>
  )
}

export function EditableCardActions({
  canSubmit,
  dirty,
  formId,
  onCancel,
  pending,
  pendingLabel = "Saving changes",
  submitLabel = "Save changes",
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
        {pending ? (
          <PendingIcon data-icon="inline-start" />
        ) : (
          <SaveChangesIcon aria-hidden="true" data-icon="inline-start" />
        )}
        {label}
      </Button>
    </CardFooter>
  )
}
