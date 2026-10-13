import { ListExpansionIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"

export const COLLAPSED_LIST_LIMIT = 10

export function revealedRowClassName(index: number) {
  return index >= COLLAPSED_LIST_LIMIT
    ? "animate-in fade-in-0 duration-standard ease-enter"
    : undefined
}

export function ListExpansionToggle({
  controls,
  expanded,
  noun,
  onExpandedChange,
  total,
}: {
  controls: string
  expanded: boolean
  noun: string
  onExpandedChange: (expanded: boolean) => void
  total: number
}) {
  return (
    <Button
      aria-controls={controls}
      aria-expanded={expanded}
      onClick={() => onExpandedChange(!expanded)}
      size="sm"
      type="button"
      variant="ghost"
    >
      <ListExpansionIcon
        aria-hidden="true"
        className="transition-transform group-aria-expanded/button:rotate-180"
        data-icon="inline-start"
      />
      {expanded ? `Show fewer ${noun}` : `Show all ${total} ${noun}`}
    </Button>
  )
}
