import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TableHead } from "@/components/ui/table"
import type {
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"

export function SortableTableHead({
  active,
  direction,
  field,
  label,
  onChange,
}: {
  active: boolean
  direction: SortDirection
  field: ResourceSort
  label: string
  onChange: (field: ResourceSort, direction: SortDirection) => void
}) {
  const nextDirection = active
    ? direction === "asc"
      ? "desc"
      : "asc"
    : field === "name"
      ? "asc"
      : "desc"
  const Icon = active
    ? direction === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon
    : ChevronsUpDownIcon

  return (
    <TableHead aria-sort={active ? sortAria(direction) : "none"}>
      <Button
        aria-label={
          active
            ? `${label}, sorted ${sortAria(direction)}. Sort ${sortAria(nextDirection)}.`
            : `Sort by ${label.toLowerCase()} ${sortAria(nextDirection)}.`
        }
        className="-ml-2"
        onClick={() => onChange(field, nextDirection)}
        size="sm"
        type="button"
        variant="ghost"
      >
        {label}
        <Icon data-icon="inline-end" />
      </Button>
    </TableHead>
  )
}

function sortAria(direction: SortDirection) {
  return direction === "asc" ? "ascending" : "descending"
}
