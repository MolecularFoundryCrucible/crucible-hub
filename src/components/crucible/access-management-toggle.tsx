import {
  FinishManagingAccessIcon,
  ManageAccessIcon,
} from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function AccessManagementToggle({
  active,
  disabled,
  onChange,
  subject,
}: {
  active: boolean
  disabled?: boolean
  onChange: (active: boolean) => void
  subject: string
}) {
  const label = active ? `Finish managing ${subject}` : `Manage ${subject}`
  const Icon = active ? FinishManagingAccessIcon : ManageAccessIcon

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(!active)}
            size="icon-sm"
            type="button"
            variant={active ? "secondary" : "outline"}
          />
        }
      >
        <Icon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
