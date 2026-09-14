import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type CreatedRange = {
  createdFrom?: string
  createdTo?: string
}

export function CollectionCreatedRangeFields({
  describedBy,
  idPrefix,
  invalid = () => false,
  onChange,
  value,
}: {
  describedBy?: string
  idPrefix: string
  invalid?: (field: keyof CreatedRange) => boolean
  onChange: (field: keyof CreatedRange, value: string | undefined) => void
  value: CreatedRange
}) {
  return (
    <>
      <Field data-invalid={invalid("createdFrom")}>
        <FieldLabel htmlFor={`${idPrefix}-created-from`}>
          Created from (UTC)
        </FieldLabel>
        <Input
          aria-describedby={invalid("createdFrom") ? describedBy : undefined}
          aria-invalid={invalid("createdFrom") || undefined}
          id={`${idPrefix}-created-from`}
          onChange={(event) =>
            onChange("createdFrom", event.target.value || undefined)
          }
          type="date"
          value={value.createdFrom ?? ""}
        />
      </Field>
      <Field data-invalid={invalid("createdTo")}>
        <FieldLabel htmlFor={`${idPrefix}-created-to`}>
          Created to (UTC)
        </FieldLabel>
        <Input
          aria-describedby={invalid("createdTo") ? describedBy : undefined}
          aria-invalid={invalid("createdTo") || undefined}
          id={`${idPrefix}-created-to`}
          onChange={(event) =>
            onChange("createdTo", event.target.value || undefined)
          }
          type="date"
          value={value.createdTo ?? ""}
        />
      </Field>
    </>
  )
}

type CollectionOrder = {
  direction?: string
  sort?: string
}

export function CollectionOrderFields({
  allowDefault = true,
  describedBy,
  idPrefix,
  invalid = () => false,
  onChange,
  value,
}: {
  allowDefault?: boolean
  describedBy?: string
  idPrefix: string
  invalid?: (field: keyof CollectionOrder) => boolean
  onChange: (value: CollectionOrder) => void
  value: CollectionOrder
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
          onChange={(event) =>
            onChange({
              direction: event.target.value
                ? (value.direction ?? "desc")
                : undefined,
              sort: event.target.value || undefined,
            })
          }
          value={value.sort ?? ""}
        >
          {allowDefault ? (
            <NativeSelectOption value="">Default</NativeSelectOption>
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
            onChange={(event) =>
              onChange({ ...value, direction: event.target.value })
            }
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
