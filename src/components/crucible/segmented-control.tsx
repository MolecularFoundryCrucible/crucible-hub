import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export function SegmentedControl<TValue extends string>({
  ariaLabel,
  className,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string
  className?: string
  onValueChange: (value: TValue) => void
  options: readonly { label: string; value: TValue }[]
  value: TValue
}) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      className={cn("gap-1 rounded-lg bg-muted p-1", className)}
      onValueChange={(values) => {
        const selected = values.at(-1)
        const selectedOption = options.find(
          (option) => option.value === selected
        )
        if (selectedOption) onValueChange(selectedOption.value)
      }}
      size="sm"
      value={[value]}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
