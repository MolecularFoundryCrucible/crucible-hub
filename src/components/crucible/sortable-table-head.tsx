import { TableHead } from "@/components/ui/table"
import type {
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"
import { SortableHeaderButton, sortAria } from "./sortable-header-button"

export function SortableTableHead({
  active,
  className,
  direction,
  field,
  label,
  onChange,
}: {
  active: boolean
  className?: string
  direction: SortDirection
  field: ResourceSort
  label: string
  onChange: (field: ResourceSort, direction: SortDirection) => void
}) {
  return (
    <TableHead
      aria-sort={active ? sortAria(direction) : "none"}
      className={className}
    >
      <SortableHeaderButton
        active={active}
        className="-ml-2"
        direction={direction}
        label={label}
        onChange={(nextDirection) => onChange(field, nextDirection)}
        preferredDirection={field === "name" ? "asc" : "desc"}
      />
    </TableHead>
  )
}
