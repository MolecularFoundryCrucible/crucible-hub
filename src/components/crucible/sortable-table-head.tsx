import { TableHead } from "@/components/ui/table"
import type { SortDirection } from "@/data/crucible/collection-query"
import { SortableHeaderButton, sortAria } from "./sortable-header-button"

export function SortableTableHead<TField extends string>({
  active,
  className,
  direction,
  field,
  label,
  onChange,
  preferredDirection,
}: {
  active: boolean
  className?: string
  direction: SortDirection
  field: TField
  label: string
  onChange: (field: TField, direction: SortDirection) => void
  preferredDirection?: SortDirection
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
        preferredDirection={
          preferredDirection ?? (field === "name" ? "asc" : "desc")
        }
      />
    </TableHead>
  )
}
