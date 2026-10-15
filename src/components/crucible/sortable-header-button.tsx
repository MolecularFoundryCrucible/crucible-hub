import {
  SortAscendingIcon,
  SortDescendingIcon,
  SortUnselectedIcon,
} from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import type { SortDirection } from "@/data/crucible/collection-query"

export function SortableHeaderButton({
  active,
  className,
  direction,
  label,
  onChange,
  preferredDirection,
}: {
  active: boolean
  className?: string
  direction: SortDirection
  label: string
  onChange: (direction: SortDirection) => void
  preferredDirection: SortDirection
}) {
  const nextDirection = active
    ? direction === "asc"
      ? "desc"
      : "asc"
    : preferredDirection
  const Icon = active
    ? direction === "asc"
      ? SortAscendingIcon
      : SortDescendingIcon
    : SortUnselectedIcon

  return (
    <Button
      aria-label={
        active
          ? `${label}, sorted ${sortAria(direction)}. Sort ${sortAria(nextDirection)}.`
          : `Sort by ${label.toLowerCase()} ${sortAria(preferredDirection)}.`
      }
      className={className}
      onClick={() => onChange(nextDirection)}
      size="table-header"
      type="button"
      variant="ghost"
    >
      {label}
      <Icon aria-hidden="true" data-icon="inline-end" />
    </Button>
  )
}

export function sortAria(direction: SortDirection) {
  return direction === "asc" ? "ascending" : "descending"
}
