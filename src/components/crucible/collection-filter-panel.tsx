import {
  CompactLabelTooltip,
  compactLabelProps,
} from "@/components/crucible/compact-label-tooltip"
import { FilterIcon } from "@/components/crucible/icons"
import { RemovablePill } from "@/components/crucible/removable-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const visibleFilterLimit = 3

export type CollectionActiveFilter = {
  id: string
  label: string
}

export function collectionActiveFilter(
  id: string,
  label: string | undefined
): CollectionActiveFilter | undefined {
  return label ? { id, label } : undefined
}

export function collectionActiveFilters(
  ...filters: Array<CollectionActiveFilter | undefined>
): readonly CollectionActiveFilter[] {
  return filters.filter(
    (filter): filter is CollectionActiveFilter => filter !== undefined
  )
}

export function CollectionFilterPanel({
  activeFilters,
  children,
  footer,
  onClearFilters,
  onOpenChange,
  onRemoveFilter,
  open,
  title = "Filters",
}: {
  activeFilters: readonly CollectionActiveFilter[]
  children: React.ReactNode
  footer: React.ReactNode
  onClearFilters: () => void
  onOpenChange: (open: boolean) => void
  onRemoveFilter: (id: string) => void
  open: boolean
  title?: string
}) {
  const visibleFilters = activeFilters.slice(0, visibleFilterLimit)
  const hiddenFilterCount = activeFilters.length - visibleFilters.length

  return (
    <>
      <Sheet onOpenChange={onOpenChange} open={open}>
        <CompactLabelTooltip label="Filters">
          <SheetTrigger
            render={
              <Button
                aria-label={
                  activeFilters.length
                    ? `Filters, ${activeFilters.length} active`
                    : "Filters"
                }
                variant="outline"
              />
            }
          >
            <FilterIcon aria-hidden="true" data-icon="inline-start" />
            <span
              className="@max-labels/content:sr-only"
              {...compactLabelProps}
            >
              Filters
            </span>
            {activeFilters.length ? (
              <Badge variant="secondary">{activeFilters.length}</Badge>
            ) : null}
          </SheetTrigger>
        </CompactLabelTooltip>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            {children}
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            {footer}
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {visibleFilters.map((filter) => (
        <RemovablePill
          data-filter-id={filter.id}
          key={filter.id}
          label={filter.label}
          onRemove={() => onRemoveFilter(filter.id)}
          removeAriaLabel={`Remove filter: ${filter.label}`}
        />
      ))}
      {hiddenFilterCount > 0 ? (
        <Badge variant="outline">+{hiddenFilterCount} more</Badge>
      ) : null}
      {activeFilters.length > 1 ? (
        <Button
          onClick={onClearFilters}
          size="xs"
          type="button"
          variant="ghost"
        >
          Clear all
        </Button>
      ) : null}
    </>
  )
}
