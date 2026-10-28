import { useEffect, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"

import { ComboboxStatus } from "@/components/crucible/resource-search-combobox"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { personDisplayName } from "@/components/crucible/person-identity"
import { formatUsername } from "@/lib/username"
import { cn } from "@/lib/utils"
import { resourceDisplayName } from "@/lib/resource-name"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  datasetFacetQueryOptions,
  sampleFacetQueryOptions,
} from "@/data/crucible/facets.queries"
import type { FacetContext } from "@/data/crucible/facets.queries"
import type {
  DatasetFacetField,
  DatasetFacetFilters,
  FacetSelection,
  SampleFacetField,
  SampleFacetFilters,
  WorkspaceFacetBucket,
} from "@/data/crucible/facets"

export type { FacetSelection } from "@/data/crucible/facets"

const facetFilterOrdering = { direction: "desc", sort: "count" } as const
/** Typing keeps loading values until this many match or none remain. */
const searchMatchTarget = 20

export function SampleFacetFilter({
  enabled,
  field,
  filters,
  ...props
}: FacetFilterProps & { field: SampleFacetField }) {
  const scope = useWorkspaceScope()
  const query = useInfiniteQuery({
    ...sampleFacetQueryOptions(scope, field, filters, {
      ordering: facetFilterOrdering,
    }),
    enabled,
  })
  return <FacetFilter field={field} query={query} {...props} />
}

export function DatasetFacetFilter({
  enabled,
  field,
  filters,
  ...props
}: FacetFilterProps & { field: DatasetFacetField }) {
  const scope = useWorkspaceScope()
  const query = useInfiniteQuery({
    ...datasetFacetQueryOptions(scope, field, filters, {
      ordering: facetFilterOrdering,
    }),
    enabled,
  })
  return <FacetFilter field={field} query={query} {...props} />
}

type FacetFilterProps = {
  enabled: boolean
  filters: FacetContext & DatasetFacetFilters & SampleFacetFilters
  id: string
  label: string
  onChange: (selection: FacetSelection) => void
  /** Name to show for a selected value that has not loaded yet. */
  selectedLabel?: string
  selection: FacetSelection
}

type FacetQuery = {
  data?: { pages: readonly { items: readonly WorkspaceFacetBucket[] }[] }
  fetchNextPage: () => Promise<unknown>
  hasNextPage: boolean
  isError: boolean
  isFetchNextPageError: boolean
  isFetchingNextPage: boolean
  isPending: boolean
  refetch: () => Promise<unknown>
}

function FacetFilter({
  field,
  query,
  selectedLabel,
  selection,
  ...props
}: Omit<FacetFilterProps, "enabled" | "filters"> & {
  field: DatasetFacetField | SampleFacetField
  query: FacetQuery
}) {
  const options = (query.data?.pages.flatMap((page) => page.items) ?? []).map(
    (bucket): FilterValueOption => ({
      count: bucket.count,
      label: facetBucketLabel(bucket, field),
      selection:
        bucket.value === null
          ? { kind: "null" }
          : { kind: "value", value: bucket.value },
    })
  )
  return (
    <FilterValuePicker
      {...props}
      hasMore={query.hasNextPage}
      loadMore={() => void query.fetchNextPage()}
      loadingMore={query.isFetchingNextPage}
      loadMoreFailed={query.isFetchNextPageError}
      nullLabel={facetNullLabel(field)}
      options={options}
      pending={query.isPending}
      retry={() => void query.refetch()}
      failed={query.isError}
      selectedLabel={selectedLabel}
      selection={selection}
    />
  )
}

export type FilterValueOption = {
  count?: number
  label: string
  selection: FacetSelection
}

type PickerItem = FilterValueOption & { key: string }

/**
 * A searchable single-value filter: typing narrows the loaded values, more
 * values load inside the popup as it scrolls or while a search finds too few,
 * and the unspecified value stays first.
 */
export function FilterValuePicker({
  failed = false,
  hasMore = false,
  id,
  label,
  loadMore,
  loadMoreFailed = false,
  loadingMore = false,
  nullLabel = "Unspecified",
  onChange,
  options,
  pending = false,
  retry,
  selectedLabel,
  selection,
}: {
  failed?: boolean
  hasMore?: boolean
  id: string
  label: string
  loadMore?: () => void
  loadMoreFailed?: boolean
  loadingMore?: boolean
  nullLabel?: string
  onChange: (selection: FacetSelection) => void
  options: readonly FilterValueOption[]
  pending?: boolean
  retry?: () => void
  selectedLabel?: string
  selection: FacetSelection
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const loaded = options.map((option): PickerItem => ({
    ...option,
    key: encodeSelection(option.selection),
  }))
  const all = [
    ...loaded.filter((item) => item.selection.kind === "null"),
    ...loaded.filter((item) => item.selection.kind === "value"),
  ]
  const selectedKey =
    selection.kind === "all" ? undefined : encodeSelection(selection)
  const selected =
    selection.kind === "all"
      ? null
      : (all.find((item) => item.key === selectedKey) ?? {
          key: encodeSelection(selection),
          label:
            selection.kind === "null"
              ? nullLabel
              : (selectedLabel ?? facetValueLabel(selection.value)),
          selection,
        })
  if (selected && !all.some((item) => item.key === selected.key)) {
    all.unshift(selected)
  }
  const search = typed.trim().toLowerCase()
  const items = search
    ? all.filter((item) => item.label.toLowerCase().includes(search))
    : all
  const canLoadMore = hasMore && !loadingMore && !failed && loadMore

  useEffect(() => {
    if (open && search && items.length < searchMatchTarget && canLoadMore) {
      loadMore()
    }
  }, [canLoadMore, items.length, loadMore, open, search])

  function loadMoreNearEnd(element: HTMLElement) {
    const nearEnd =
      element.scrollHeight - element.scrollTop - element.clientHeight < 48
    if (nearEnd && canLoadMore) loadMore()
  }

  const noun = label.toLowerCase()
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox<PickerItem>
        autoHighlight
        filter={null}
        isItemEqualToValue={(item, value) => item.key === value.key}
        itemToStringLabel={(item) => item.label}
        items={items}
        loopFocus
        onInputValueChange={(next, details) => {
          if (details.reason === "input-change") setTyped(next)
        }}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setTyped("")
        }}
        onValueChange={(item) => {
          onChange(item ? item.selection : { kind: "all" })
          setTyped("")
        }}
        open={open}
        value={selected}
      >
        <ComboboxInput
          autoComplete="off"
          className="w-full"
          clearLabel={`Clear ${noun}`}
          id={id}
          onClick={() => setOpen(true)}
          placeholder={`Any ${noun}`}
          showClear={selected !== null}
        />
        <ComboboxContent className="sm:w-max sm:max-w-md">
          {items.length > 0 ? (
            <ComboboxList
              aria-label={`${label} values`}
              onScroll={(event) => loadMoreNearEnd(event.currentTarget)}
            >
              {(item: PickerItem) => (
                <ComboboxItem key={item.key} value={item}>
                  <span
                    className={cn(
                      "line-clamp-2 min-w-0 flex-1 break-words",
                      item.selection.kind === "null" && "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </span>
                  {item.count === undefined ? null : (
                    <span className="shrink-0 text-supporting text-muted-foreground tabular-nums">
                      {item.count.toLocaleString()}
                    </span>
                  )}
                </ComboboxItem>
              )}
            </ComboboxList>
          ) : null}
          {pending || loadingMore ? (
            <ComboboxStatus role="status">
              Loading {noun} values…
            </ComboboxStatus>
          ) : failed ? (
            <ComboboxStatus role="alert">
              {loadMoreFailed
                ? `More ${noun} values could not be loaded.`
                : `${label} values could not be loaded.`}{" "}
              {retry ? (
                <Button
                  onClick={() => (loadMoreFailed ? loadMore?.() : retry())}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Retry
                </Button>
              ) : null}
            </ComboboxStatus>
          ) : items.length === 0 ? (
            <ComboboxStatus>
              {search ? `No ${noun} values match.` : `No ${noun} values.`}
            </ComboboxStatus>
          ) : null}
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}

function facetValueLabel(value: string | null) {
  if (value === null) return "Unspecified"
  return value === "" ? "Empty value" : value
}

export function facetNullLabel(field: DatasetFacetField | SampleFacetField) {
  if (field === "owner") return "Unknown owner"
  if (field === "instrument") return "No registered instrument"
  if (field === "project") return "No primary project"
  return "Unspecified"
}

export function facetBucketLabel(
  bucket: WorkspaceFacetBucket,
  field: DatasetFacetField | SampleFacetField
) {
  if (bucket.value === null) return facetNullLabel(field)
  if (bucket.label !== null && bucket.label !== undefined) {
    return bucket.label === "" ? facetValueLabel(bucket.value) : bucket.label
  }
  if (field === "owner" && bucket.owner) {
    const name = personDisplayName(bucket.owner)
    const username = formatUsername(bucket.owner.username, "handle")
    return username && name !== username ? `${name} (${username})` : name
  }
  if (field === "instrument" && bucket.instrument) {
    return resourceDisplayName(
      "instrument",
      bucket.instrument.instrument_name,
      {
        identifier: bucket.instrument.instrument_id,
        mfid: bucket.instrument.unique_id,
      }
    )
  }
  if (field === "project" && bucket.project) {
    return resourceDisplayName("project", bucket.project.title, {
      identifier: bucket.project.project_id,
      mfid: bucket.project.unique_id,
    })
  }
  return facetValueLabel(bucket.value)
}

function encodeSelection(selection: FacetSelection) {
  if (selection.kind === "all") return "all"
  if (selection.kind === "null") return "null"
  return JSON.stringify(["value", selection.value])
}
