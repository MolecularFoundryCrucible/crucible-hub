import { FinishManagingIcon, ManageIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function ManagementToggle({
  active,
  disabled,
  disabledReason,
  onChange,
  subject,
}: {
  active: boolean
  disabled?: boolean
  disabledReason?: string
  onChange: (active: boolean) => void
  subject: string
}) {
  const label = `Manage ${subject}`
  const Icon = active ? FinishManagingIcon : ManageIcon
  const button = (
    <Button
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => onChange(!active)}
      size="sm"
      type="button"
      variant="ghost"
    >
      <Icon aria-hidden="true" data-icon="inline-start" />
      {active ? "Done" : "Edit"}
    </Button>
  )
  if (!disabled || !disabledReason) return button

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />} tabIndex={-1}>
        {button}
      </TooltipTrigger>
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  )
}
