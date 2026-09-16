import { useInfiniteQuery } from "@tanstack/react-query"

import {
  DataFormatFieldIcon,
  DataTypeFieldIcon,
  MeasurementFieldIcon,
  SessionFieldIcon,
} from "@/components/crucible/icons"
import {
  PersonIdentity,
  personIsServiceAccount,
} from "@/components/crucible/person-identity"
import {
  PrincipalTypeIcon,
  ResourceTypeIcon,
} from "@/components/crucible/resource-type-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { SortableHeaderButton } from "@/components/crucible/sortable-header-button"
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
import { facetOrderingForGroupOrder } from "@/data/crucible/collection-browse"
import type {
  CollectionBrowseOption,
  CollectionGroupOrder,
} from "@/data/crucible/collection-browse"
import type { SortDirection } from "@/data/crucible/collection-query"
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

export function CollectionToolbar({
  actions,
  primary,
}: {
  actions?: React.ReactNode
  primary: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">{primary}</div>
      {actions ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export function CollectionGroupControl<TField extends string>({
  disabled = false,
  field,
  id,
  onChange,
  options,
  view,
}: {
  disabled?: boolean
  field: TField
  id: string
  onChange: (field: TField | undefined) => void
  options: readonly CollectionBrowseOption<TField>[]
  view: "grouped" | "list"
}) {
  return (
    <Field className="w-auto min-w-0 flex-none" orientation="horizontal">
      <FieldLabel className="shrink-0 whitespace-nowrap" htmlFor={id}>
        Group by
      </FieldLabel>
      <NativeSelect
        className="w-44 min-w-0"
        disabled={disabled}
        id={id}
        onChange={(event) => {
          const next = options.find(
            (option) => option.value === event.target.value
          )
          onChange(next?.value)
        }}
        value={view === "grouped" ? field : ""}
      >
        <NativeSelectOption value="">None</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  )
}

export function SampleCollectionBrowser({
  children,
  direction,
  field,
  filters,
  onOrderChange,
  order,
  onSelect,
  selection,
}: CollectionBrowserProps<SampleFacetField>) {
  const scope = useWorkspaceScope()
  const query = useInfiniteQuery(
    sampleFacetQueryOptions(scope, field, filters, {
      excludeField: false,
      ordering: facetOrderingForGroupOrder(order, direction),
    })
  )
  return (
    <CollectionBrowser
      direction={direction}
      field={field}
      onOrderChange={onOrderChange}
      onSelect={onSelect}
      order={order}
      query={query}
      selection={selection}
    >
      {children}
    </CollectionBrowser>
  )
}

export function DatasetCollectionBrowser({
  children,
  direction,
  field,
  filters,
  onOrderChange,
  order,
  onSelect,
  selection,
}: CollectionBrowserProps<DatasetFacetField>) {
  const scope = useWorkspaceScope()
  const query = useInfiniteQuery(
    datasetFacetQueryOptions(scope, field, filters, {
      excludeField: false,
      ordering: facetOrderingForGroupOrder(order, direction),
    })
  )
  return (
    <CollectionBrowser
      direction={direction}
      field={field}
      onOrderChange={onOrderChange}
      onSelect={onSelect}
      order={order}
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
  direction: SortDirection
  field: TField
  filters: FacetContext & DatasetFacetFilters & SampleFacetFilters
  onOrderChange: (order: CollectionGroupOrder, direction: SortDirection) => void
  order: CollectionGroupOrder
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
  direction,
  field,
  onOrderChange,
  onSelect,
  order,
  query,
  selection,
}: {
  children: React.ReactNode
  direction: SortDirection
  field: DatasetFacetField | SampleFacetField
  onOrderChange: (order: CollectionGroupOrder, direction: SortDirection) => void
  onSelect: (selection: FacetSelection) => void
  order: CollectionGroupOrder
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
          <CollectionGroupHeaders
            direction={direction}
            field={field}
            onChange={onOrderChange}
            order={order}
          />
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
                  className="group-directory-columns grid w-full text-left"
                  onClick={() => onSelect(selection)}
                  type="button"
                  variant="secondary"
                >
                  <span className="flex min-w-0 items-center gap-2 overflow-hidden">
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
                  <span aria-hidden="true" />
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
                    className="group-directory-columns grid w-full text-left"
                    key={bucket.value === null ? "null" : bucket.value}
                    onClick={() => onSelect(bucketSelection)}
                    type="button"
                    variant={active ? "secondary" : "ghost"}
                  >
                    <span className="flex min-w-0 items-center gap-2 overflow-hidden">
                      <FacetFieldIcon bucket={bucket} field={field} />
                      <FacetBucketName bucket={bucket} field={field} />
                    </span>
                    <span className="justify-self-end text-supporting text-muted-foreground tabular-nums">
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
              <EmptyTitle>
                Choose {indefiniteArticle(selectionLabel)} {selectionLabel}
              </EmptyTitle>
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

function CollectionGroupHeaders({
  direction,
  field,
  onChange,
  order,
}: {
  direction: SortDirection
  field: DatasetFacetField | SampleFacetField
  onChange: (order: CollectionGroupOrder, direction: SortDirection) => void
  order: CollectionGroupOrder
}) {
  return (
    <div className="group-directory-columns grid items-center pb-1">
      <SortableHeaderButton
        active={order === "name"}
        className="justify-self-start"
        direction={direction}
        label={facetFieldColumnLabel(field)}
        onChange={(nextDirection) => onChange("name", nextDirection)}
        preferredDirection="asc"
      />
      <SortableHeaderButton
        active={order === "count"}
        className="justify-self-end"
        direction={direction}
        label="Count"
        onChange={(nextDirection) => onChange("count", nextDirection)}
        preferredDirection="desc"
      />
    </div>
  )
}

function FacetBucketName({
  bucket,
  field,
}: {
  bucket: WorkspaceFacetBucket
  field: DatasetFacetField | SampleFacetField
}) {
  const label = facetBucketLabel(bucket, field)
  if (field === "owner" && bucket.owner) {
    return (
      <span className="min-w-0 truncate" title={label}>
        <PersonIdentity
          className="block min-w-0 truncate"
          nameStyle="abbreviated"
          person={bucket.owner}
          presentation="inline"
        />
      </span>
    )
  }
  return (
    <span className="truncate" title={label}>
      {label}
    </span>
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

function facetFieldColumnLabel(field: DatasetFacetField | SampleFacetField) {
  if (field === "sample_type") return "Sample type"
  if (field === "data_format") return "Data format"
  if (field === "owner") return "Owner"
  if (field === "instrument") return "Instrument"
  if (field === "project") return "Project"
  if (field === "session") return "Session"
  return "Measurement"
}

function indefiniteArticle(value: string) {
  return /^[aeiou]/i.test(value) ? "an" : "a"
}

function sameSelection(left: FacetSelection, right: FacetSelection) {
  return (
    left.kind === right.kind &&
    (left.kind !== "value" ||
      (right.kind === "value" && left.value === right.value))
  )
}
