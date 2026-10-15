import { useState } from "react"
import type { FocusEventHandler } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"

import { CreateFacetValueIcon } from "@/components/crucible/icons"
import { ComboboxStatus } from "@/components/crucible/resource-search-combobox"
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import type {
  DatasetFacetField,
  SampleFacetField,
  WorkspaceFacetBucket,
} from "@/data/crucible/facets"
import {
  datasetFacetQueryOptions,
  sampleFacetQueryOptions,
} from "@/data/crucible/facets.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"

const byUse = { direction: "desc", sort: "count" } as const

export type FacetComboboxItem =
  | {
      count: number
      kind: "existing"
      value: string
    }
  | {
      kind: "create"
      value: string
    }

export type FacetComboboxTarget =
  | {
      field: DatasetFacetField
      kind: "dataset"
    }
  | {
      field: SampleFacetField
      kind: "sample"
    }

export type FacetComboboxProps = FacetComboboxTarget & {
  "aria-describedby"?: string | undefined
  "aria-errormessage"?: string | undefined
  "aria-invalid"?: boolean | undefined
  autoFocus?: boolean | undefined
  describedBy?: string | undefined
  disabled?: boolean | undefined
  errorId?: string | undefined
  id: string
  invalid?: boolean | undefined
  label: string
  maxLength?: number | undefined
  name?: string | undefined
  onBlur?: FocusEventHandler<HTMLInputElement> | undefined
  onChange: (value: string) => void
  placeholder?: string | undefined
  projectMfid?: string | null | undefined
  required?: boolean | undefined
  scope: IdentityScope
  value: string
}

export function buildFacetComboboxState(
  buckets: readonly WorkspaceFacetBucket[] | undefined,
  value: string,
  options: { filterByValue?: boolean } = {}
): {
  items: FacetComboboxItem[]
  selectedItem: FacetComboboxItem | null
} {
  const existingItems: FacetComboboxItem[] = (buckets ?? []).flatMap(
    (bucket) =>
      bucket.value && bucket.value.trim().length > 0
        ? [
            {
              count: bucket.count,
              kind: "existing" as const,
              value: bucket.value,
            },
          ]
        : []
  )
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return {
      items: existingItems,
      selectedItem: null,
    }
  }

  const normalized = trimmed.toLowerCase()
  const exactMatch: FacetComboboxItem | null =
    existingItems.find((item) => item.value.toLowerCase() === normalized) ??
    null
  const filterByValue = options.filterByValue ?? true

  if (!filterByValue && exactMatch) {
    return {
      items: existingItems,
      selectedItem: exactMatch,
    }
  }

  const matchingExisting = existingItems.filter((item) =>
    item.value.toLowerCase().includes(normalized)
  )
  const items: FacetComboboxItem[] = exactMatch
    ? matchingExisting
    : [...matchingExisting, { kind: "create", value: trimmed }]

  return {
    items,
    selectedItem: exactMatch,
  }
}

function useSampleFacetBuckets(
  scope: IdentityScope,
  field: SampleFacetField,
  projectMfid: string | null | undefined,
  enabled: boolean
) {
  const filterContext = projectMfid
    ? { projectMfid, projectScope: "all" as const }
    : {}
  return useInfiniteQuery({
    ...sampleFacetQueryOptions(scope, field, filterContext, {
      ordering: byUse,
    }),
    enabled,
  })
}

function useDatasetFacetBuckets(
  scope: IdentityScope,
  field: DatasetFacetField,
  projectMfid: string | null | undefined,
  enabled: boolean
) {
  const filterContext = projectMfid
    ? { projectMfid, projectScope: "all" as const }
    : {}
  return useInfiniteQuery({
    ...datasetFacetQueryOptions(scope, field, filterContext, {
      ordering: byUse,
    }),
    enabled,
  })
}

export function FacetCombobox(props: FacetComboboxProps) {
  return props.kind === "sample" ? (
    <SampleFacetCombobox {...props} />
  ) : (
    <DatasetFacetCombobox {...props} />
  )
}

function SampleFacetCombobox(
  props: Extract<FacetComboboxProps, { kind: "sample" }>
) {
  const [hasActivated, setHasActivated] = useState(false)
  const query = useSampleFacetBuckets(
    props.scope,
    props.field,
    props.projectMfid,
    hasActivated && !props.disabled
  )
  const buckets = query.data?.pages.flatMap((page) => page.items)
  return (
    <FacetComboboxControl
      {...props}
      buckets={buckets}
      isPending={query.isPending}
      onActivate={() => setHasActivated(true)}
    />
  )
}

function DatasetFacetCombobox(
  props: Extract<FacetComboboxProps, { kind: "dataset" }>
) {
  const [hasActivated, setHasActivated] = useState(false)
  const query = useDatasetFacetBuckets(
    props.scope,
    props.field,
    props.projectMfid,
    hasActivated && !props.disabled
  )
  const buckets = query.data?.pages.flatMap((page) => page.items)
  return (
    <FacetComboboxControl
      {...props}
      buckets={buckets}
      isPending={query.isPending}
      onActivate={() => setHasActivated(true)}
    />
  )
}

function FacetComboboxControl({
  "aria-describedby": ariaDescribedBy,
  "aria-errormessage": ariaErrorMessage,
  "aria-invalid": ariaInvalid,
  autoFocus,
  buckets,
  describedBy,
  disabled = false,
  errorId,
  id,
  invalid,
  isPending,
  label,
  maxLength,
  name,
  onActivate,
  onBlur,
  onChange,
  placeholder,
  required,
  value,
}: FacetComboboxProps & {
  buckets: readonly WorkspaceFacetBucket[] | undefined
  isPending: boolean
  onActivate: () => void
}) {
  const [open, setOpen] = useState(false)
  const [hasTypedSinceOpen, setHasTypedSinceOpen] = useState(false)
  const { items, selectedItem } = buildFacetComboboxState(buckets, value, {
    filterByValue: hasTypedSinceOpen,
  })

  return (
    <Combobox<FacetComboboxItem>
      autoHighlight
      disabled={disabled}
      filter={null}
      inputValue={value}
      isItemEqualToValue={(item, selected) =>
        item.kind === selected.kind && item.value === selected.value
      }
      itemToStringLabel={(item) => item.value}
      items={items}
      loopFocus
      onInputValueChange={(nextValue, details) => {
        if (
          details.reason !== "input-change" &&
          details.reason !== "clear-press"
        ) {
          details.cancel()
          return
        }
        onActivate()
        setHasTypedSinceOpen(true)
        onChange(nextValue)
        setOpen(true)
      }}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onActivate()
        } else {
          setHasTypedSinceOpen(false)
        }
        setOpen(nextOpen)
      }}
      onValueChange={(item, details) => {
        if (!item) {
          details.cancel()
          return
        }
        onChange(item.value)
        setHasTypedSinceOpen(false)
        setOpen(false)
      }}
      open={open}
      value={selectedItem}
    >
      <ComboboxInput
        aria-describedby={ariaDescribedBy ?? describedBy}
        aria-errormessage={ariaErrorMessage ?? errorId}
        aria-invalid={ariaInvalid ?? (invalid || undefined)}
        autoComplete="off"
        autoFocus={autoFocus}
        className="w-full"
        disabled={disabled}
        id={id}
        maxLength={maxLength}
        name={name}
        onBlur={(event) => {
          const trimmed = value.trim()
          if (trimmed !== value) {
            onChange(trimmed)
          }
          onBlur?.(event)
        }}
        onClick={() => {
          if (!disabled) {
            onActivate()
            setOpen(true)
          }
        }}
        onFocus={() => {
          if (!disabled) {
            onActivate()
          }
        }}
        placeholder={placeholder}
        required={required}
      />
      <ComboboxContent>
        {items.length === 0 ? (
          isPending ? (
            <ComboboxStatus role="status">
              Loading {label.toLowerCase()} options…
            </ComboboxStatus>
          ) : (
            <ComboboxStatus>
              No existing {label.toLowerCase()} values. Type to create one.
            </ComboboxStatus>
          )
        ) : (
          <ComboboxList aria-label={`${label} options`}>
            {(item: FacetComboboxItem) => (
              <ComboboxItem key={`${item.kind}:${item.value}`} value={item}>
                {item.kind === "create" ? (
                  <>
                    <CreateFacetValueIcon
                      aria-hidden="true"
                      className="text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      Create &ldquo;{item.value}&rdquo;
                    </span>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate">
                      {item.value}
                    </span>
                    <span className="shrink-0 text-supporting text-muted-foreground tabular-nums">
                      {item.count.toLocaleString()}
                    </span>
                  </>
                )}
              </ComboboxItem>
            )}
          </ComboboxList>
        )}
      </ComboboxContent>
    </Combobox>
  )
}
