import { useInfiniteQuery } from "@tanstack/react-query"

import {
  DataFormatFieldIcon,
  DataTypeFieldIcon,
  MeasurementFieldIcon,
  SessionFieldIcon,
} from "@/components/crucible/icons"
import { personIsServiceAccount } from "@/components/crucible/person-identity"
import {
  PrincipalTypeIcon,
  ResourceTypeIcon,
} from "@/components/crucible/resource-type-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import type { CollectionBrowseOption } from "@/data/crucible/collection-browse"
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
import { facetBucketLabel } from "./collection-facet-filter"

export function CollectionBrowseToolbar<TField extends string>({
  field,
  id,
  onFieldChange,
  onViewChange,
  options,
  view,
}: {
  field: TField
  id: string
  onFieldChange: (field: TField) => void
  onViewChange: (view: "grouped" | "list") => void
  options: readonly CollectionBrowseOption<TField>[]
  view: "grouped" | "list"
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap gap-2" aria-label="Collection view">
        <Button
          aria-pressed={view === "list"}
          onClick={() => onViewChange("list")}
          type="button"
          variant={view === "list" ? "secondary" : "ghost"}
        >
          List
        </Button>
        <Button
          aria-pressed={view === "grouped"}
          onClick={() => onViewChange("grouped")}
          type="button"
          variant={view === "grouped" ? "secondary" : "ghost"}
        >
          Browse
        </Button>
      </div>
      {view === "grouped" ? (
        <Field className="w-full sm:w-auto sm:min-w-48">
          <FieldLabel htmlFor={id}>Browse by</FieldLabel>
          <NativeSelect
            id={id}
            onChange={(event) => {
              const next = options.find(
                (option) => option.value === event.target.value
              )
              if (next) onFieldChange(next.value)
            }}
            value={field}
          >
            {options.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
    </div>
  )
}

export function SampleCollectionBrowser({
  children,
  field,
  filters,
  onSelect,
  selection,
}: CollectionBrowserProps<SampleFacetField>) {
  const scope = useWorkspaceScope()
  const query = useInfiniteQuery(
    sampleFacetQueryOptions(scope, field, filters, { excludeField: false })
  )
  return (
    <CollectionBrowser
      field={field}
      onSelect={onSelect}
      query={query}
      selection={selection}
    >
      {children}
    </CollectionBrowser>
  )
}

export function DatasetCollectionBrowser({
  children,
  field,
  filters,
  onSelect,
  selection,
}: CollectionBrowserProps<DatasetFacetField>) {
  const scope = useWorkspaceScope()
  const query = useInfiniteQuery(
    datasetFacetQueryOptions(scope, field, filters, { excludeField: false })
  )
  return (
    <CollectionBrowser
      field={field}
      onSelect={onSelect}
      query={query}
      selection={selection}
    >
      {children}
    </CollectionBrowser>
  )
}

type CollectionBrowserProps<
  TField extends DatasetFacetField | SampleFacetField,
> = {
  children: React.ReactNode
  field: TField
  filters: FacetContext & DatasetFacetFilters & SampleFacetFilters
  onSelect: (selection: FacetSelection) => void
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

function CollectionBrowser({
  children,
  field,
  onSelect,
  query,
  selection,
}: {
  children: React.ReactNode
  field: DatasetFacetField | SampleFacetField
  onSelect: (selection: FacetSelection) => void
  query: FacetQuery
  selection: FacetSelection
}) {
  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  const title = facetFieldLabel(field)
  const selectionLabel = facetFieldSelectionLabel(field)
  const selectedAvailable = items.some((bucket) =>
    sameSelection(
      selection,
      bucket.value === null
        ? { kind: "null" }
        : { kind: "value", value: bucket.value }
    )
  )
  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[var(--container-group-directory)_minmax(0,1fr)]">
      <Card size="sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          {query.isPending ? (
            <div className="grid gap-1" aria-label={`Loading ${title}`}>
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton className="h-8 w-full" key={index} />
              ))}
            </div>
          ) : query.isError && items.length === 0 ? (
            <Empty className="min-h-32 border" role="alert">
              <EmptyHeader>
                <EmptyTitle>Groups unavailable</EmptyTitle>
                <EmptyDescription>
                  The grouped values could not be loaded.
                </EmptyDescription>
              </EmptyHeader>
              <Button
                onClick={() => void query.refetch()}
                size="sm"
                type="button"
                variant="outline"
              >
                Retry
              </Button>
            </Empty>
          ) : items.length === 0 ? (
            <Empty className="min-h-32 border">
              <EmptyHeader>
                <EmptyTitle>No groups found</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <nav aria-label={`${title} groups`} className="grid gap-1">
              {selection.kind !== "all" && !selectedAvailable ? (
                <Button
                  aria-current="page"
                  className="w-full justify-between text-left"
                  onClick={() => onSelect(selection)}
                  type="button"
                  variant="secondary"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FacetFieldIcon field={field} />
                    <span className="truncate">
                      {facetBucketLabel(
                        {
                          count: 0,
                          value:
                            selection.kind === "null" ? null : selection.value,
                        },
                        field
                      )}
                    </span>
                  </span>
                </Button>
              ) : null}
              {items.map((bucket) => {
                const bucketSelection: FacetSelection =
                  bucket.value === null
                    ? { kind: "null" }
                    : { kind: "value", value: bucket.value }
                const active = sameSelection(selection, bucketSelection)
                return (
                  <Button
                    aria-current={active ? "page" : undefined}
                    className="w-full justify-between text-left"
                    key={bucket.value === null ? "null" : bucket.value}
                    onClick={() => onSelect(bucketSelection)}
                    type="button"
                    variant={active ? "secondary" : "ghost"}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FacetFieldIcon bucket={bucket} field={field} />
                      <span
                        className="truncate"
                        title={facetBucketLabel(bucket, field)}
                      >
                        {facetBucketLabel(bucket, field)}
                      </span>
                    </span>
                    <span className="shrink-0 text-supporting text-muted-foreground tabular-nums">
                      {bucket.count}
                    </span>
                  </Button>
                )
              })}
            </nav>
          )}
          {items.length ? (
            <div className="pt-2">
              {query.isFetchNextPageError ? (
                <Button
                  onClick={() => void query.fetchNextPage()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Retry more groups
                </Button>
              ) : query.hasNextPage ? (
                <Button
                  disabled={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {query.isFetchingNextPage ? "Loading..." : "Load more groups"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <div className="min-w-0">
        {selection.kind === "all" ? (
          <Empty className="min-h-state border">
            <EmptyHeader>
              <EmptyTitle>Choose a {selectionLabel}</EmptyTitle>
              <EmptyDescription>
                Select a group to browse its resources.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function FacetFieldIcon({
  bucket,
  field,
}: {
  bucket?: WorkspaceFacetBucket
  field: DatasetFacetField | SampleFacetField
}) {
  if (field === "owner") {
    return bucket?.owner ? (
      <PrincipalTypeIcon
        type={personIsServiceAccount(bucket.owner) ? "service_account" : "user"}
      />
    ) : (
      <PrincipalTypeIcon type="unknown" />
    )
  }
  if (field === "instrument") {
    return <ResourceTypeIcon data-icon="inline-start" type="instrument" />
  }
  if (field === "project") {
    return <ResourceTypeIcon data-icon="inline-start" type="project" />
  }
  const Icon =
    field === "measurement"
      ? MeasurementFieldIcon
      : field === "session"
        ? SessionFieldIcon
        : field === "data_format"
          ? DataFormatFieldIcon
          : DataTypeFieldIcon
  return <Icon aria-hidden="true" data-icon="inline-start" />
}

function facetFieldLabel(field: DatasetFacetField | SampleFacetField) {
  if (field === "sample_type") return "Sample types"
  if (field === "data_format") return "Data formats"
  if (field === "owner") return "Owners"
  if (field === "instrument") return "Instruments"
  if (field === "project") return "Primary projects"
  if (field === "session") return "Sessions"
  return "Measurements"
}

function facetFieldSelectionLabel(field: DatasetFacetField | SampleFacetField) {
  if (field === "sample_type") return "sample type"
  if (field === "data_format") return "data format"
  if (field === "owner") return "owner"
  if (field === "instrument") return "instrument"
  if (field === "project") return "primary project"
  if (field === "session") return "session"
  return "measurement"
}

function sameSelection(left: FacetSelection, right: FacetSelection) {
  return (
    left.kind === right.kind &&
    (left.kind !== "value" ||
      (right.kind === "value" && left.value === right.value))
  )
}
