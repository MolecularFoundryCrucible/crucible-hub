import { DisclosureIcon, FilterIcon } from "@/components/crucible/icons"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const visibleFilterLimit = 3

export function CollectionFilterPanel({
  activeFilters,
  children,
  onOpenChange,
  open,
}: {
  activeFilters: readonly string[]
  children: React.ReactNode
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const visibleFilters = activeFilters.slice(0, visibleFilterLimit)
  const hiddenFilterCount = activeFilters.length - visibleFilters.length

  return (
    <details
      className="group/filter-panel"
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      open={open}
    >
      <summary
        aria-label={
          activeFilters.length
            ? `Filters, ${activeFilters.length} active`
            : "Filters"
        }
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden"
        )}
      >
        <FilterIcon aria-hidden="true" data-icon="inline-start" />
        Filters
        {activeFilters.length ? (
          <Badge variant="secondary">{activeFilters.length}</Badge>
        ) : null}
        <DisclosureIcon
          aria-hidden="true"
          className="transition-transform group-open/filter-panel:rotate-180"
          data-icon="inline-end"
        />
      </summary>
      <div className="mt-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        {visibleFilters.length ? (
          <div className="mb-4 flex min-w-0 flex-wrap gap-1.5">
            {visibleFilters.map((filter) => (
              <Badge className="max-w-full" key={filter} variant="outline">
                <span className="truncate">{filter}</span>
              </Badge>
            ))}
            {hiddenFilterCount > 0 ? (
              <Badge variant="outline">+{hiddenFilterCount}</Badge>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </details>
  )
}
