import { SegmentedControl } from "@/components/crucible/segmented-control"
import type { OwnershipAffiliation } from "@/data/crucible/collection-query"

export function CollectionAffiliationFilter({
  onChange,
  ownerLabel,
  value,
}: {
  onChange: (value: OwnershipAffiliation | undefined) => void
  ownerLabel: string
  value?: OwnershipAffiliation
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
