import { useEffect, useState } from "react"
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

export type SearchableResourceKind =
  "dataset" | "instrument" | "person" | "project" | "sample"

const resourceLabels = {
  dataset: { plural: "datasets", singular: "Dataset" },
  instrument: { plural: "instruments", singular: "Instrument" },
  person: { plural: "people", singular: "Person" },
  project: { plural: "projects", singular: "Project" },
  sample: { plural: "samples", singular: "Sample" },
} satisfies Record<SearchableResourceKind, { plural: string; singular: string }>

export function ResourceSearchCombobox({
  disabled = false,
  excludedIds = [],
  id,
  kind,
  onQueryChange,
  onValueChange,
  query,
  scope,
  value,
}: {
  disabled?: boolean
  excludedIds?: readonly string[]
  id: string
  kind: SearchableResourceKind
  onQueryChange: (query: string) => void
  onValueChange: (value: WorkspaceSearchResult | undefined) => void
  query: string
  scope: IdentityScope
  value: WorkspaceSearchResult | undefined
}) {
  const labels = resourceLabels[kind]
  const normalizedQuery = query.trim()
  const debouncedQuery = useDebouncedValue(normalizedQuery, 250)
  const search = useQuery({
    ...searchQueryOptions(scope, debouncedQuery, [kind]),
    enabled: debouncedQuery.length >= 3,
  })
  const excluded = new Set(excludedIds)
  const group = search.data?.groups.find((candidate) => candidate.kind === kind)
  const items =
    group?.items.filter(
      (item) => item.kind === kind && !excluded.has(item.unique_id)
    ) ?? []
  const waitingForDebounce =
    normalizedQuery.length >= 3 && normalizedQuery !== debouncedQuery
  const searching =
    normalizedQuery.length >= 3 &&
    (waitingForDebounce || search.isPending || search.isPlaceholderData)

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
        items={items}
        onInputValueChange={(nextQuery, details) => {
          onQueryChange(nextQuery)
          if (
            details.reason === "input-change" ||
            details.reason === "clear-press"
          ) {
            onValueChange(undefined)
          }
        }}
        onValueChange={(item) => {
          const nextValue = item ?? undefined
          onValueChange(nextValue)
          if (nextValue) onQueryChange(nextValue.name)
        }}
        value={value ?? null}
      >
        <ComboboxInput
          autoComplete="off"
          className="w-full"
          disabled={disabled}
          id={id}
          placeholder="Name or identifier"
          showClear={query.length > 0}
        />
        <ComboboxContent>
          {normalizedQuery.length < 3 ? (
            <ComboboxStatus>Enter at least 3 characters.</ComboboxStatus>
          ) : searching ? (
            <ComboboxStatus role="status">
              Searching {labels.plural}…
            </ComboboxStatus>
          ) : search.isError || group?.error ? (
            <ComboboxStatus role="alert">
              {labels.singular}s could not be searched.
            </ComboboxStatus>
          ) : items.length === 0 ? (
            <ComboboxStatus>
              No available {labels.plural} matched this search.
            </ComboboxStatus>
          ) : (
            <ComboboxList aria-label={`${labels.singular} search results`}>
              {(item: WorkspaceSearchResult) => (
                <ComboboxItem key={item.unique_id} value={item}>
                  {item.kind === "person" ? (
                    <span className="min-w-0 text-left">
                      <PersonIdentity
                        person={item}
                        presentation="avatar"
                        size="sm"
                      />
                      <MfidText
                        className="block break-all text-muted-foreground"
                        value={item.unique_id}
                      />
                    </span>
                  ) : (
                    <ResourceIdentity
                      context={item.context}
                      kind={item.kind}
                      mfid={item.unique_id}
                      name={item.name}
                      projectId={item.projectId}
                    />
                  )}
                </ComboboxItem>
              )}
            </ComboboxList>
          )}
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}

function ComboboxStatus({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={`px-3 py-2 text-body text-muted-foreground ${className ?? ""}`}
      {...props}
    />
  )
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeout)
  }, [delay, value])

  return debouncedValue
}
