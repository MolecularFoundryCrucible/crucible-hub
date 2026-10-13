import { CancelChangesIcon, SaveChangesIcon } from "@/components/crucible/icons"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { Button } from "@/components/ui/button"
import { CardFooter } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function EditableCardActions({
  canSubmit,
  dirty,
  formId,
  onCancel,
  pending,
  pendingLabel = "Saving changes",
  presentation = "text",
  submitLabel = "Save changes",
}: {
  canSubmit: boolean
  dirty: boolean
  formId: string
  onCancel: () => void
  pending: boolean
  pendingLabel?: string
  presentation?: "icon" | "text"
  submitLabel?: string
}) {
  const label = pending ? pendingLabel : submitLabel
  const disabled = !canSubmit || !dirty || pending
  const submit = (
    <Button
      aria-label={presentation === "icon" ? label : undefined}
      disabled={disabled}
      form={formId}
      size={presentation === "icon" ? "icon-sm" : "default"}
      type="submit"
    >
      {pending ? (
        <PendingIcon
          data-icon={presentation === "text" ? "inline-start" : undefined}
        />
      ) : (
        <SaveChangesIcon
          aria-hidden="true"
          data-icon={presentation === "text" ? "inline-start" : undefined}
        />
      )}
      {presentation === "text" ? label : null}
    </Button>
  )

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
      {presentation === "icon" ? (
        <Tooltip>
          <TooltipTrigger
            render={<span className="inline-flex" />}
            tabIndex={-1}
          >
            {submit}
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ) : (
        submit
      )}
    </CardFooter>
  )
}
