import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { defaultCollectionOrdering } from "@/data/crucible/collection-query"
import type {
  CollectionOrdering,
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"
import { defaultOrderLabel } from "@/data/crucible/filter-draft"

type CollectionOrder = {
  direction?: SortDirection
  sort?: ResourceSort
}

type CollectionOrderValue = {
  direction?: string
  sort?: string
}

export function CollectionOrderFields({
  allowDefault = true,
  defaultOrdering = defaultCollectionOrdering,
  describedBy,
  idPrefix,
  invalid = () => false,
  onChange,
  value,
}: {
  allowDefault?: boolean
  defaultOrdering?: CollectionOrdering
  describedBy?: string
  idPrefix: string
  invalid?: (field: keyof CollectionOrder) => boolean
  onChange: (value: CollectionOrder) => void
  value: CollectionOrderValue
}) {
  return (
    <>
      <Field data-invalid={invalid("sort")}>
        <FieldLabel htmlFor={`${idPrefix}-sort`}>Order by</FieldLabel>
        <NativeSelect
          aria-describedby={invalid("sort") ? describedBy : undefined}
          aria-invalid={invalid("sort") || undefined}
          className="w-full"
          id={`${idPrefix}-sort`}
          onChange={(event) => {
            const sort = resourceSort(event.target.value)
            onChange({
              direction: sort
                ? (sortDirection(value.direction ?? "") ?? "desc")
                : undefined,
              sort,
            })
          }}
          value={value.sort ?? ""}
        >
          {allowDefault ? (
            <NativeSelectOption value="">
              {defaultOrderLabel(defaultOrdering)}
            </NativeSelectOption>
          ) : null}
          <NativeSelectOption value="name">Name</NativeSelectOption>
          <NativeSelectOption value="created">Created</NativeSelectOption>
          <NativeSelectOption value="updated">Updated</NativeSelectOption>
        </NativeSelect>
      </Field>
      {value.sort || !allowDefault ? (
        <Field data-invalid={invalid("direction")}>
          <FieldLabel htmlFor={`${idPrefix}-direction`}>Direction</FieldLabel>
          <NativeSelect
            aria-describedby={invalid("direction") ? describedBy : undefined}
            aria-invalid={invalid("direction") || undefined}
            className="w-full"
            id={`${idPrefix}-direction`}
            onChange={(event) => {
              const direction = sortDirection(event.target.value)
              if (direction) {
                onChange({ direction, sort: resourceSort(value.sort ?? "") })
              }
            }}
            value={value.direction ?? "desc"}
          >
            <NativeSelectOption value="asc">Ascending</NativeSelectOption>
            <NativeSelectOption value="desc">Descending</NativeSelectOption>
          </NativeSelect>
        </Field>
      ) : null}
    </>
  )
}

function resourceSort(value: string): ResourceSort | undefined {
  return value === "created" || value === "name" || value === "updated"
    ? value
    : undefined
}

function sortDirection(value: string): SortDirection | undefined {
  return value === "asc" || value === "desc" ? value : undefined
}
