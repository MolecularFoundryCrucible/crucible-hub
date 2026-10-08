import { IndeterminateSelectionIcon } from "@/components/crucible/icons"

import { Checkbox } from "@/components/ui/checkbox"

export function RemovalCheckbox({
  checked,
  disabled = false,
  label,
  onCheckedChange,
  selectable,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onCheckedChange: (checked: boolean) => void
  selectable: boolean
}) {
  if (!selectable) {
    return (
      <span
        aria-hidden="true"
        className="flex size-4 items-center justify-center rounded-sm border border-input bg-muted/40 text-muted-foreground"
      >
        <IndeterminateSelectionIcon aria-hidden="true" className="size-3.5" />
      </span>
    )
  }
  return (
    <Checkbox
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />
  )
}
