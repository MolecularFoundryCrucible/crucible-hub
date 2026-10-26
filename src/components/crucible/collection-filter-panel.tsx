import {
  CompactLabelTooltip,
  compactLabelProps,
} from "@/components/crucible/compact-label-tooltip"
import { FilterIcon } from "@/components/crucible/icons"
import { RemovablePill } from "@/components/crucible/removable-pill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import {
  Field,
  FieldError,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
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

/** Singular and plural names of what the filters return, e.g. datasets. */
export type FilterResultNoun = readonly [one: string, other: string]

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

function applyLabel(count: number | undefined, noun: FilterResultNoun) {
  if (count === undefined) return "Apply filters"
  if (count === 0) return `No matching ${noun[1]}`
  return `Show ${count.toLocaleString()} ${count === 1 ? noun[0] : noun[1]}`
}

/**
 * The Filters button, its sheet, and the active filters beside it. The sheet
 * edits a draft: Reset restores the draft's defaults and Apply submits the
 * form named by `formId`, labelled with the draft's result count when known.
 * Clear all beside the pills removes the applied filters at once.
 */
export function CollectionFilterPanel({
  activeFilters,
  applyDisabled = false,
  children,
  formId,
  onClearFilters,
  onOpenChange,
  onRemoveFilter,
  onReset,
  open,
  resetDisabled = false,
  resultCount,
  resultNoun,
  title = "Filters",
}: {
  activeFilters: readonly CollectionActiveFilter[]
  applyDisabled?: boolean
  children: React.ReactNode
  formId: string
  onClearFilters: () => void
  onOpenChange: (open: boolean) => void
  onRemoveFilter: (id: string) => void
  onReset: () => void
  open: boolean
  resetDisabled?: boolean
  resultCount?: number
  resultNoun: FilterResultNoun
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
        <SheetContent className="w-full gap-0 sm:max-w-(--spacing-inspector-width)">
          <SheetHeader className="border-b">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {children}
          </div>
          <SheetFooter className="flex-row items-center justify-between border-t">
            <Button
              disabled={resetDisabled}
              onClick={onReset}
              type="button"
              variant="ghost"
            >
              Reset
            </Button>
            <Button
              disabled={applyDisabled || resultCount === 0}
              form={formId}
              type="submit"
            >
              {applyLabel(resultCount, resultNoun)}
            </Button>
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
        <Button
          aria-label={`Show all ${activeFilters.length} filters`}
          onClick={() => onOpenChange(true)}
          size="pill"
          type="button"
          variant="outline"
        >
          +{hiddenFilterCount} more
        </Button>
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

/** A titled group of fields inside the Filters sheet. */
export function FilterSection({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <FieldSet className="gap-4 border-b pb-5 last:border-b-0 last:pb-0">
      <FieldLegend className="mb-1 text-muted-foreground" variant="label">
        {title}
      </FieldLegend>
      {children}
    </FieldSet>
  )
}

/** The Filters sheet's form: one column of sections. */
export function FilterForm({
  children,
  id,
  onSubmit,
}: {
  children: React.ReactNode
  id: string
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form
      className="flex flex-col gap-5"
      id={id}
      noValidate
      onSubmit={onSubmit}
    >
      {children}
    </form>
  )
}

/** A labelled choice among two to four fixed filter options. */
export function FilterChoice<TValue extends string>({
  error,
  label,
  onChange,
  options,
  value,
}: {
  error?: string
  label: string
  onChange: (value: TValue) => void
  options: readonly { label: string; value: TValue }[]
  value: TValue
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldTitle>{label}</FieldTitle>
      <SegmentedControl
        ariaLabel={label}
        className="w-full *:flex-1"
        onValueChange={onChange}
        options={options}
        value={value}
      />
      <FieldError errors={error ? [{ message: error }] : []} />
    </Field>
  )
}
