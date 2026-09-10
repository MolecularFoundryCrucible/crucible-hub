import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { CollectionAffiliation } from "@/data/crucible/collection-query"

export function CollectionAffiliationFilter({
  id,
  onChange,
  value,
}: {
  id: string
  onChange: (value: CollectionAffiliation | undefined) => void
  value?: CollectionAffiliation
}) {
  return (
    <Field className="w-fit items-center" orientation="horizontal">
      <FieldLabel htmlFor={id}>Ownership</FieldLabel>
      <NativeSelect
        id={id}
        onChange={(event) =>
          onChange(event.target.value === "owner" ? "owner" : undefined)
        }
        value={value ?? "all"}
      >
        <NativeSelectOption value="all">All accessible</NativeSelectOption>
        <NativeSelectOption value="owner">Owned by me</NativeSelectOption>
      </NativeSelect>
    </Field>
  )
}
