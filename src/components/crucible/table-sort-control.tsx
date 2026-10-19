import { useId } from "react"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { SortDirection } from "@/data/crucible/collection-query"

export type TableSortField<TField extends string> = {
  field: TField
  kind?: "text" | "date"
  label: string
  preferredDirection?: SortDirection
}

const directionLabels = {
  date: { asc: "oldest first", desc: "newest first" },
  text: { asc: "A to Z", desc: "Z to A" },
} as const

export function TableSortControl<TField extends string>({
  direction,
  fields,
  onChange,
  sort,
}: {
  direction: SortDirection
  fields: readonly TableSortField<TField>[]
  onChange: (field: TField, direction: SortDirection) => void
  sort: TField | undefined
}) {
  const id = useId()
  const options = fields.flatMap((option) => {
    const kind = option.kind ?? "text"
    const first: SortDirection =
      option.preferredDirection ?? (kind === "date" ? "desc" : "asc")
    const second: SortDirection = first === "asc" ? "desc" : "asc"
    return [first, second].map((optionDirection) => ({
      direction: optionDirection,
      field: option.field,
      label: `${option.label}, ${directionLabels[kind][optionDirection]}`,
      value: `${option.field}:${optionDirection}`,
    }))
  })
  const selected = options.find(
    (option) => option.field === sort && option.direction === direction
  )

  return (
    <div className="table-card-only items-center gap-2 border-b px-3 py-2">
      <label className="text-label text-muted-foreground" htmlFor={id}>
        Sort by
      </label>
      <NativeSelect
        className="max-w-72 min-w-0 flex-1"
        id={id}
        onChange={(event) => {
          const option = options.find(
            (candidate) => candidate.value === event.target.value
          )
          if (option) onChange(option.field, option.direction)
        }}
        size="sm"
        value={selected?.value ?? ""}
      >
        {selected ? null : (
          <NativeSelectOption disabled value="">
            Default order
          </NativeSelectOption>
        )}
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
