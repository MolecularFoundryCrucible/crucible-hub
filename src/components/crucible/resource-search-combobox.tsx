import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { PersonIdentity } from "@/components/crucible/person-identity"
import { MfidText } from "@/components/crucible/mfid-text"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"
import { searchQueryOptions } from "@/data/crucible/search.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type { WorkspaceSearchResult } from "@/data/crucible/workspace-source"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { searchDebounceMs, searchMinQueryLength } from "@/lib/search"

export type SearchableResourceKind =
  "dataset" | "instrument" | "person" | "project" | "sample"

export function useResourceComboboxState({
  active = true,
  allowBrowse,
  excludedIds,
  excludeServiceAccounts,
  kind,
  normalizedQuery,
  pinnedValue,
  scope,
  serviceAccountsOnly = false,
}: {
  active?: boolean
  allowBrowse: boolean
  excludedIds: readonly string[]
  excludeServiceAccounts: boolean
  kind: SearchableResourceKind
  normalizedQuery: string
  pinnedValue?: WorkspaceSearchResult | undefined
  scope: IdentityScope
  serviceAccountsOnly?: boolean
}) {
  const debouncedQuery = useDebouncedValue(normalizedQuery, searchDebounceMs)

  const browse = useQuery({
    ...searchQueryOptions(scope, "", [kind], undefined, serviceAccountsOnly),
    enabled: allowBrowse && active,
  })

  const search = useQuery({
    ...searchQueryOptions(
      scope,
      debouncedQuery,
      [kind],
      undefined,
      serviceAccountsOnly
    ),
    enabled: debouncedQuery.length >= searchMinQueryLength,
  })

  const excluded = new Set(excludedIds)
  const isBrowseMode =
    allowBrowse && normalizedQuery.length < searchMinQueryLength

  const browseGroup = browse.data?.groups.find(
    (candidate) => candidate.kind === kind
  )
  const baseBrowseItems =
    browseGroup?.items.filter(
      (item) =>
        item.kind === kind &&
        !excluded.has(item.unique_id) &&
        (!excludeServiceAccounts || item.is_service_account !== true)
    ) ?? []

  const browseItems =
    pinnedValue &&
    !baseBrowseItems.some((item) => item.unique_id === pinnedValue.unique_id)
      ? [pinnedValue, ...baseBrowseItems]
      : baseBrowseItems

  const searchGroup = search.data?.groups.find(
    (candidate) => candidate.kind === kind
  )
  const searchItems =
    searchGroup?.items.filter(
      (item) =>
        item.kind === kind &&
        !excluded.has(item.unique_id) &&
        (!excludeServiceAccounts || item.is_service_account !== true)
    ) ?? []

  const filteredBrowseItems =
    normalizedQuery.length > 0 && isBrowseMode
      ? browseItems.filter((item) => {
          const q = normalizedQuery.toLowerCase()
          return [item.name, item.context, item.projectId, item.unique_id].some(
            (v) => v?.toLowerCase().includes(q)
          )
        })
      : browseItems

  const items = isBrowseMode ? filteredBrowseItems : searchItems

  const waitingForDebounce =
    normalizedQuery.length >= searchMinQueryLength &&
    normalizedQuery !== debouncedQuery
  const searching =
    normalizedQuery.length >= searchMinQueryLength &&
    (waitingForDebounce || search.isPending || search.isPlaceholderData)

  return {
    browse,
    browseGroup,
    isBrowseMode,
    items,
    search,
    searchGroup,
    searching,
  }
}

export function ResourceComboboxContent({
  allowBrowse,
  labels,
  normalizedQuery,
  presentation = "form",
  state,
}: {
  allowBrowse: boolean
  labels: { plural: string; pluralTitle: string; singular: string }
  normalizedQuery: string
  presentation?: ResourceChooserPresentation
  state: ReturnType<typeof useResourceComboboxState>
}) {
  const {
    browse,
    browseGroup,
    isBrowseMode,
    items,
    search,
    searchGroup,
    searching,
  } = state
  const filter = presentation === "filter"
  const renderItem = filter ? renderFilterComboboxItem : renderComboboxItem

  return (
    <ComboboxContent
      className={filter ? "sm:w-max sm:max-w-md" : "sm:min-w-md"}
    >
      {!allowBrowse && normalizedQuery.length < searchMinQueryLength ? (
        <ComboboxStatus>Enter at least 3 characters.</ComboboxStatus>
      ) : isBrowseMode && normalizedQuery.length === 0 ? (
        browse.isPending ? (
          <ComboboxStatus role="status">
            Loading {labels.plural}…
          </ComboboxStatus>
        ) : browse.isError || browseGroup?.error ? (
          <ComboboxStatus role="alert">
            {labels.pluralTitle} could not be loaded.
          </ComboboxStatus>
        ) : items.length === 0 ? (
          <ComboboxStatus>No available {labels.plural} found.</ComboboxStatus>
        ) : (
          <>
            {filter ? null : (
              <ComboboxStatus className="border-b text-supporting">
                Available {labels.plural} (enter at least 3 characters to search
                all)
              </ComboboxStatus>
            )}
            <ComboboxList aria-label={`${labels.singular} search results`}>
              {(item: WorkspaceSearchResult) => (
                <ComboboxItem key={item.unique_id} value={item}>
                  {renderItem(item)}
                </ComboboxItem>
              )}
            </ComboboxList>
            {filter ? (
              <ComboboxStatus className="border-t text-supporting">
                Type 3 or more characters to search all {labels.plural}.
              </ComboboxStatus>
            ) : null}
          </>
        )
      ) : isBrowseMode && normalizedQuery.length > 0 ? (
        items.length === 0 ? (
          <ComboboxStatus>
            No available {labels.plural} matched. Enter at least 3 characters to
            search all.
          </ComboboxStatus>
        ) : (
          <>
            <ComboboxList aria-label={`${labels.singular} search results`}>
              {(item: WorkspaceSearchResult) => (
                <ComboboxItem key={item.unique_id} value={item}>
                  {renderItem(item)}
                </ComboboxItem>
              )}
            </ComboboxList>
            <ComboboxStatus className="border-t text-supporting">
              Enter at least 3 characters to search all {labels.plural}.
            </ComboboxStatus>
          </>
        )
      ) : searching ? (
        <ComboboxStatus role="status">
          Searching {labels.plural}…
        </ComboboxStatus>
      ) : search.isError || searchGroup?.error ? (
        <ComboboxStatus role="alert">
          {labels.pluralTitle} could not be searched.
        </ComboboxStatus>
      ) : items.length === 0 ? (
        <ComboboxStatus>
          No available {labels.plural} matched this search.
        </ComboboxStatus>
      ) : (
        <ComboboxList aria-label={`${labels.singular} search results`}>
          {(item: WorkspaceSearchResult) => (
            <ComboboxItem key={item.unique_id} value={item}>
              {renderComboboxItem(item)}
            </ComboboxItem>
          )}
        </ComboboxList>
      )}
    </ComboboxContent>
  )
}

const resourceLabels = {
  dataset: { plural: "datasets", pluralTitle: "Datasets", singular: "Dataset" },
  instrument: {
    plural: "instruments",
    pluralTitle: "Instruments",
    singular: "Instrument",
  },
  person: { plural: "people", pluralTitle: "People", singular: "Person" },
  project: { plural: "projects", pluralTitle: "Projects", singular: "Project" },
  sample: { plural: "samples", pluralTitle: "Samples", singular: "Sample" },
} satisfies Record<
  SearchableResourceKind,
  { plural: string; pluralTitle: string; singular: string }
>

export function ResourceSearchCombobox({
  allowBrowse = false,
  clearAfterSelect = false,
  disabled = false,
  excludeServiceAccounts = false,
  excludedIds = [],
  id,
  kind,
  onQueryChange,
  onValueChange,
  query,
  scope,
  serviceAccountsOnly = false,
  value,
}: {
  allowBrowse?: boolean
  clearAfterSelect?: boolean
  disabled?: boolean
  excludeServiceAccounts?: boolean
  excludedIds?: readonly string[]
  id: string
  kind: SearchableResourceKind
  onQueryChange: (query: string) => void
  onValueChange: (value: WorkspaceSearchResult | undefined) => void
  query: string
  scope: IdentityScope
  serviceAccountsOnly?: boolean
  value?: WorkspaceSearchResult | undefined
}) {
  const labels =
    kind === "person" && serviceAccountsOnly
      ? {
          plural: "service accounts",
          pluralTitle: "Service accounts",
          singular: "Service account",
        }
      : resourceLabels[kind]
  const normalizedQuery = query.trim()
  const [open, setOpen] = useState(false)

  const state = useResourceComboboxState({
    active: open,
    allowBrowse,
    excludedIds,
    excludeServiceAccounts,
    kind,
    normalizedQuery,
    scope,
    serviceAccountsOnly,
  })

  return (
    <Field>
      <FieldLabel htmlFor={id}>Search {labels.plural}</FieldLabel>
      <Combobox
        disabled={disabled}
        filter={null}
        inputValue={query}
        isItemEqualToValue={(item, selected) =>
          item.unique_id === selected.unique_id
        }
        itemToStringLabel={(item) => item.name}
        items={state.items}
        loopFocus
        autoHighlight
        onInputValueChange={(nextQuery, details) => {
          if (
            details.reason !== "input-change" &&
            details.reason !== "clear-press"
          ) {
            return
          }
          onQueryChange(nextQuery)
          setOpen(allowBrowse ? true : nextQuery.trim().length > 0)
          onValueChange(undefined)
        }}
        onValueChange={(item, details) => {
          const nextValue = item ?? undefined
          onValueChange(nextValue)
          if (nextValue && clearAfterSelect) {
            details.cancel()
            onQueryChange("")
            setOpen(false)
            return
          }
          setOpen(false)
        }}
        onOpenChange={setOpen}
        open={open}
        value={value ?? null}
      >
        <ComboboxInput
          aria-label={`Search ${labels.plural}`}
          autoComplete="off"
          className="w-full"
          disabled={disabled}
          id={id}
          onClick={() => {
            if (allowBrowse) setOpen(true)
          }}
          onFocus={() => {
            if (allowBrowse) setOpen(true)
          }}
          placeholder="Name or identifier"
          showClear={query.length > 0}
        />
        <ResourceComboboxContent
          allowBrowse={allowBrowse}
          labels={labels}
          normalizedQuery={normalizedQuery}
          state={state}
        />
      </Combobox>
    </Field>
  )
}

export type ResourceChooserPresentation = "filter" | "form"

/** A plain name row, matching the Filters panel's value pickers. */
function renderFilterComboboxItem(item: WorkspaceSearchResult) {
  return (
    <span className="line-clamp-2 min-w-0 flex-1 break-words">{item.name}</span>
  )
}

function renderComboboxItem(item: WorkspaceSearchResult) {
  return item.kind === "person" ? (
    <span className="min-w-0 text-left">
      <PersonIdentity person={item} presentation="avatar" size="sm" />
      <MfidText
        className="block break-all text-muted-foreground"
        presentation="supporting"
        value={item.unique_id}
      />
    </span>
  ) : (
    <ResourceIdentity
      context={item.context}
      kind={item.kind}
      mfid={item.unique_id}
      name={item.name}
      presentation="collection"
      projectId={item.projectId}
    />
  )
}

export function ComboboxStatus({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={`px-3 py-2 text-body text-muted-foreground ${className ?? ""}`}
      {...props}
    />
  )
}
