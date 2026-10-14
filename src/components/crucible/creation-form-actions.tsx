import { PendingIcon } from "@/components/crucible/pending-icon"
import { Button } from "@/components/ui/button"
import { CardFooter } from "@/components/ui/card"

export function CreationFormActions({
  cancelDisabled = false,
  formId,
  label,
  onCancel,
  pending = false,
  submitDisabled = false,
}: {
  cancelDisabled?: boolean
  formId: string
  label: string
  onCancel: () => void
  pending?: boolean
  submitDisabled?: boolean
}) {
  return (
    <CardFooter className="justify-end gap-2">
      <Button
        disabled={cancelDisabled}
        onClick={onCancel}
        type="button"
        variant="outline"
      >
        Cancel
      </Button>
      <Button disabled={submitDisabled} form={formId} type="submit">
        {pending ? <PendingIcon data-icon="inline-start" /> : null}
        {label}
      </Button>
    </CardFooter>
  )
}
