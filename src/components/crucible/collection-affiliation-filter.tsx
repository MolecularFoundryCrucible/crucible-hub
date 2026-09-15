import { Button } from "@/components/ui/button"
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
  return (
    <div
      aria-label="Ownership scope"
      className="flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
      role="group"
    >
      <Button
        aria-pressed={!value}
        onClick={() => onChange(undefined)}
        size="sm"
        type="button"
        variant={!value ? "outline" : "ghost"}
      >
        All
      </Button>
      <Button
        aria-pressed={value === "owner"}
        onClick={() => onChange("owner")}
        size="sm"
        type="button"
        variant={value === "owner" ? "outline" : "ghost"}
      >
        {ownerLabel}
      </Button>
    </div>
  )
}
