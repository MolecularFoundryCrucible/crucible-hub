import { FilterIcon } from "@/components/crucible/icons"
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

export function CollectionFilterPanel({
  activeFilters,
  children,
  footer,
  onOpenChange,
  open,
  title = "Filters",
}: {
  activeFilters: readonly string[]
  children: React.ReactNode
  footer: React.ReactNode
  onOpenChange: (open: boolean) => void
  open: boolean
  title?: string
}) {
  const visibleFilters = activeFilters.slice(0, visibleFilterLimit)
  const hiddenFilterCount = activeFilters.length - visibleFilters.length

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
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
        Filters
        {activeFilters.length ? (
          <Badge variant="secondary">{activeFilters.length}</Badge>
        ) : null}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
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
        <SheetFooter className="flex-row justify-end border-t">
          {footer}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
