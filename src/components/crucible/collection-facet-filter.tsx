import { useInfiniteQuery } from "@tanstack/react-query"

import { PendingIcon } from "@/components/crucible/pending-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { personDisplayName } from "@/components/crucible/person-identity"
import { formatUsername } from "@/lib/username"
import { resourceDisplayName } from "@/lib/resource-name"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
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

export function SampleFacetFilter({
  enabled,
  field,
  filters,
  id,
  label,
  onChange,
  selection,
}: FacetFilterProps & { field: SampleFacetField }) {
  const scope = useWorkspaceScope()
  const query = useInfiniteQuery({
    ...sampleFacetQueryOptions(scope, field, filters),
    enabled,
  })
  return (
    <FacetFilter
      field={field}
      id={id}
      label={label}
      onChange={onChange}
      query={query}
      selection={selection}
    />
  )
}

export function DatasetFacetFilter({
  enabled,
  field,
  filters,
  id,
  label,
  onChange,
  selection,
}: FacetFilterProps & { field: DatasetFacetField }) {
  const scope = useWorkspaceScope()
  const query = useInfiniteQuery({
    ...datasetFacetQueryOptions(scope, field, filters),
    enabled,
  })
  return (
    <FacetFilter
      field={field}
      id={id}
      label={label}
      onChange={onChange}
      query={query}
      selection={selection}
    />
  )
}

type FacetFilterProps = {
  enabled: boolean
  filters: FacetContext & DatasetFacetFilters & SampleFacetFilters
  id: string
  label: string
  onChange: (selection: FacetSelection) => void
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
  id,
  label,
  onChange,
  query,
  selection,
}: Omit<FacetFilterProps, "enabled" | "filters"> & {
  field: DatasetFacetField | SampleFacetField
  query: FacetQuery
}) {
  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  const selectedAvailable = items.some((item) =>
    selection.kind === "null"
      ? item.value === null
      : selection.kind === "value" && item.value === selection.value
  )
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        className="w-full"
        id={id}
        onChange={(event) => onChange(decodeSelection(event.target.value))}
        value={encodeSelection(selection)}
      >
        <NativeSelectOption value="all">All</NativeSelectOption>
        {selection.kind !== "all" && !selectedAvailable ? (
          <NativeSelectOption value={encodeSelection(selection)}>
            {facetValueLabel(
              selection.kind === "null" ? null : selection.value
            )}
          </NativeSelectOption>
        ) : null}
        {items.map((item) => (
          <NativeSelectOption
            key={item.value === null ? "null" : `value:${item.value}`}
            value={encodeSelection(
              item.value === null
                ? { kind: "null" }
                : { kind: "value", value: item.value }
            )}
          >
            {facetBucketLabel(item, field)} ({item.count})
          </NativeSelectOption>
        ))}
        {query.isPending ? (
          <NativeSelectOption disabled value="loading">
            Loading values...
          </NativeSelectOption>
        ) : null}
        {query.isError && items.length === 0 ? (
          <NativeSelectOption disabled value="unavailable">
            Values unavailable
          </NativeSelectOption>
        ) : null}
      </NativeSelect>
      {query.isFetchNextPageError ? (
        <Button
          className="self-start"
          onClick={() => void query.fetchNextPage()}
          size="sm"
          type="button"
          variant="ghost"
        >
          Retry more values
        </Button>
      ) : query.isError ? (
        <Button
          className="self-start"
          onClick={() => void query.refetch()}
          size="sm"
          type="button"
          variant="ghost"
        >
          Retry values
        </Button>
      ) : query.hasNextPage ? (
        <Button
          className="self-start"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
          size="sm"
          type="button"
          variant="ghost"
        >
          {query.isFetchingNextPage ? (
            <PendingIcon data-icon="inline-start" />
          ) : null}
          Load more values
        </Button>
      ) : null}
    </Field>
  )
}

export function facetValueLabel(value: string | null) {
  if (value === null) return "Unspecified"
  return value === "" ? "Empty value" : value
}

export function facetBucketLabel(
  bucket: WorkspaceFacetBucket,
  field: DatasetFacetField | SampleFacetField
) {
  if (bucket.value === null) {
    if (field === "owner") return "Unknown owner"
    if (field === "instrument") return "No registered instrument"
    if (field === "project") return "No primary project"
    return "Unspecified"
  }
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

function decodeSelection(value: string): FacetSelection {
  if (value === "all") return { kind: "all" }
  if (value === "null") return { kind: "null" }
  try {
    const decoded: unknown = JSON.parse(value)
    if (
      Array.isArray(decoded) &&
      decoded.length === 2 &&
      decoded[0] === "value" &&
      typeof decoded[1] === "string"
    ) {
      return { kind: "value", value: decoded[1] }
    }
  } catch {
    return { kind: "all" }
  }
  return { kind: "all" }
}
