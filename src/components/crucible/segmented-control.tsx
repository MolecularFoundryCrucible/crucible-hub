import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function SegmentedControl<TValue extends string>({
  ariaLabel,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string
  onValueChange: (value: TValue) => void
  options: readonly { label: string; value: TValue }[]
  value: TValue
}) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      className="gap-1 rounded-lg bg-muted p-1"
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
