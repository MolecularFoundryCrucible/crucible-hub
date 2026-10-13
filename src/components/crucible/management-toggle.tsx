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

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />} tabIndex={-1}>
        <Button
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={() => onChange(!active)}
          size="icon-sm"
          type="button"
          variant={active ? "secondary" : "outline"}
        >
          <Icon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {disabled && disabledReason
          ? disabledReason
          : active
            ? `Finish managing ${subject}`
            : label}
      </TooltipContent>
    </Tooltip>
  )
}
