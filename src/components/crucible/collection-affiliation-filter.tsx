import { SegmentedControl } from "@/components/crucible/segmented-control"
import type { CollectionAffiliation } from "@/data/crucible/collection-query"

export function CollectionAffiliationFilter({
  onChange,
  ownerLabel,
  value,
}: {
  onChange: (value: CollectionAffiliation | undefined) => void
  ownerLabel: string
  value?: CollectionAffiliation
}) {
  const options = [
    { label: "All", value: "all" },
    { label: ownerLabel, value: "owner" },
  ] as const

  return (
    <SegmentedControl
      ariaLabel="Ownership scope"
      onValueChange={(nextValue) =>
        onChange(nextValue === "owner" ? "owner" : undefined)
      }
      options={options}
      value={value ?? "all"}
    />
  )
}
