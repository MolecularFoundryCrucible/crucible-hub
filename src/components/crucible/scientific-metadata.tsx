import { useEffect, useState } from "react"
import type { ReactNode } from "react"

import { MetadataDisclosureIcon, SearchIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import type { WorkspaceMetadataValue } from "@/data/crucible/workspace-source"

const compactArrayLimit = 6
const arrayPageSize = 25

type MetadataEntry = readonly [string, WorkspaceMetadataValue]
export type ScientificMetadataExpansion = ReturnType<
  typeof useScientificMetadataExpansion
>

export function ScientificMetadataSearch({
  onChange,
  value,
}: {
  onChange: (value: string) => void
  value: string
}) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label="Search scientific metadata"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Find a field or value"
        type="search"
        value={value}
      />
    </InputGroup>
  )
}

export function ScientificMetadataViewer({
  emptyMessage,
  expansion,
  expandFirstLevel = false,
  metadata,
}: {
  emptyMessage?: string
  expansion?: ScientificMetadataExpansion
  expandFirstLevel?: boolean
  metadata: WorkspaceMetadataValue | undefined
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const hasFields =
    metadata !== undefined &&
    isMetadataObject(metadata) &&
    Object.keys(metadata).length > 0

  useEffect(() => setSearchQuery(""), [metadata])

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {hasFields ? (
        <ScientificMetadataSearch
          onChange={setSearchQuery}
          value={searchQuery}
        />
      ) : null}
      <ScientificMetadata
        emptyMessage={emptyMessage}
        expansion={expansion}
        expandFirstLevel={expandFirstLevel}
        metadata={metadata}
        searchQuery={searchQuery}
      />
    </div>
  )
}

export function ScientificMetadata({
  emptyMessage = "No scientific metadata is available.",
  expansion,
  expandFirstLevel = false,
  metadata,
  searchQuery = "",
  showExpansionAction = false,
}: {
  emptyMessage?: string
  expansion?: ScientificMetadataExpansion
  expandFirstLevel?: boolean
  metadata: WorkspaceMetadataValue | undefined
  searchQuery?: string
  showExpansionAction?: boolean
}) {
  const internalExpansion = useScientificMetadataExpansion(
    metadata,
    expandFirstLevel
  )
  const activeExpansion = expansion ?? internalExpansion

  if (metadata === null || metadata === undefined || isEmptyValue(metadata)) {
    return <p className="text-body text-muted-foreground">{emptyMessage}</p>
  }

  if (isMetadataArray(metadata)) {
    return (
      <MetadataTree
        entries={arrayEntries(metadata)}
        expansion={activeExpansion}
        searchQuery={searchQuery}
        showExpansionAction={showExpansionAction}
      />
    )
  }

  if (!isMetadataObject(metadata)) {
    return <MetadataScalar value={metadata} />
  }

  return (
    <MetadataTree
      entries={sortedEntries(metadata)}
      expansion={activeExpansion}
      searchQuery={searchQuery}
      showExpansionAction={showExpansionAction}
    />
  )
}

export function useScientificMetadataExpansion(
  metadata: WorkspaceMetadataValue | undefined,
  expandFirstLevel = false
) {
  const entries = metadataEntries(metadata)
  const allPaths = expandablePaths(entries)
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(
    () => new Set(expandFirstLevel ? expandablePaths(entries, [], true) : [])
  )

  useEffect(() => {
    const nextEntries = metadataEntries(metadata)
    setExpandedPaths(
      new Set(expandFirstLevel ? expandablePaths(nextEntries, [], true) : [])
    )
  }, [expandFirstLevel, metadata])

  const allExpanded =
    allPaths.length > 0 && allPaths.every((path) => expandedPaths.has(path))

  function setExpanded(path: string, expanded: boolean) {
    setExpandedPaths((current) => {
      if (current.has(path) === expanded) return current
      const next = new Set(current)
      if (expanded) next.add(path)
      else next.delete(path)
      return next
    })
  }

  return {
    allExpanded,
    canExpand: allPaths.length > 0,
    expandedPaths,
    setExpanded,
    toggleAll: () =>
      setExpandedPaths(allExpanded ? new Set() : new Set(allPaths)),
  }
}

export function ScientificMetadataExpansionAction({
  expansion,
}: {
  expansion: ScientificMetadataExpansion
}) {
  if (!expansion.canExpand) return null
  return (
    <Button
      onClick={expansion.toggleAll}
      size="sm"
      type="button"
      variant="outline"
    >
      {expansion.allExpanded ? "Collapse all" : "Expand all"}
    </Button>
  )
}

function MetadataTree({
  entries,
  expansion,
  searchQuery,
  showExpansionAction,
}: {
  entries: readonly MetadataEntry[]
  expansion: ScientificMetadataExpansion
  searchQuery: string
  showExpansionAction: boolean
}) {
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleEntries = filterEntries(entries, normalizedQuery)

  return (
    <div className="min-w-0">
      {showExpansionAction && expansion.canExpand ? (
        <div className="mb-2 flex justify-end">
          <ScientificMetadataExpansionAction expansion={expansion} />
        </div>
      ) : null}
      {visibleEntries.length > 0 ? (
        <MetadataEntries
          entries={visibleEntries}
          expandedPaths={expansion.expandedPaths}
          onExpandedChange={expansion.setExpanded}
          path={[]}
          searchQuery={normalizedQuery}
        />
      ) : (
        <p className="text-body text-muted-foreground">
          No metadata matches this search.
        </p>
      )}
    </div>
  )
}

function MetadataEntries({
  entries,
  expandedPaths,
  onExpandedChange,
  path,
  searchQuery,
}: {
  entries: readonly MetadataEntry[]
  expandedPaths: ReadonlySet<string>
  onExpandedChange: (path: string, expanded: boolean) => void
  path: readonly string[]
  searchQuery: string
}) {
  return (
    <dl className="min-w-0">
      {entries.map(([key, value]) => (
        <MetadataEntryRow
          expandedPaths={expandedPaths}
          key={key}
          name={key}
          onExpandedChange={onExpandedChange}
          path={[...path, key]}
          searchQuery={searchQuery}
          value={value}
        />
      ))}
    </dl>
  )
}

function MetadataEntryRow({
  expandedPaths,
  name,
  onExpandedChange,
  path,
  searchQuery,
  value,
}: {
  expandedPaths: ReadonlySet<string>
  name: string
  onExpandedChange: (path: string, expanded: boolean) => void
  path: readonly string[]
  searchQuery: string
  value: WorkspaceMetadataValue
}) {
  if (isCompactScalarArray(value)) {
    return (
      <MetadataValueRow label={name}>
        <MetadataInlineArray value={value} />
      </MetadataValueRow>
    )
  }

  if (isMetadataArray(value) || isMetadataObject(value)) {
    return (
      <div className="min-w-0 border-t first:border-t-0">
        <dt className="sr-only">{name}</dt>
        <dd className="min-w-0">
          <MetadataCollection
            expandedPaths={expandedPaths}
            forceOpen={searchQuery.length > 0}
            label={name}
            onExpandedChange={onExpandedChange}
            path={path}
            searchQuery={keyMatches(name, searchQuery) ? "" : searchQuery}
            value={value}
          />
        </dd>
      </div>
    )
  }

  return (
    <MetadataValueRow label={name}>
      <MetadataScalar value={value} />
    </MetadataValueRow>
  )
}

function MetadataValueRow({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1 border-t py-1.5 first:border-t-0 sm:grid-cols-3 sm:gap-2">
      <dt className="text-label-compact break-words text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 sm:col-span-2">{children}</dd>
    </div>
  )
}

function MetadataCollection({
  expandedPaths,
  forceOpen,
  label,
  onExpandedChange,
  path,
  searchQuery,
  value,
}: {
  expandedPaths: ReadonlySet<string>
  forceOpen: boolean
  label: string
  onExpandedChange: (path: string, expanded: boolean) => void
  path: readonly string[]
  searchQuery: string
  value:
    | readonly WorkspaceMetadataValue[]
    | Readonly<Record<string, WorkspaceMetadataValue>>
}) {
  const [visibleArrayItems, setVisibleArrayItems] = useState(arrayPageSize)
  const array = isMetadataArray(value)
  const entries = array ? arrayEntries(value) : sortedEntries(value)

  if (entries.length === 0) {
    return (
      <div className="grid min-w-0 grid-cols-1 gap-1 py-1.5 sm:grid-cols-3 sm:gap-2">
        <span className="text-label-compact break-words text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-body text-muted-foreground sm:col-span-2">
          {array ? "[]" : "{}"}
        </span>
      </div>
    )
  }

  const filteredEntries = filterEntries(entries, searchQuery)
  const displayedEntries = array
    ? filteredEntries.slice(0, visibleArrayItems)
    : filteredEntries
  const remainingItems = filteredEntries.length - displayedEntries.length
  const totalCount = array
    ? itemCount(entries.length)
    : fieldCount(entries.length, "field")
  const count =
    searchQuery && filteredEntries.length < entries.length
      ? `${filteredEntries.length} of ${totalCount}`
      : totalCount
  const pathKey = metadataPath(path)

  return (
    <details
      className="metadata-disclosure min-w-0"
      onToggle={(event) => onExpandedChange(pathKey, event.currentTarget.open)}
      open={forceOpen || expandedPaths.has(pathKey)}
    >
      <summary
        aria-label={`${label}: ${count}`}
        className="metadata-disclosure-summary min-h-9 cursor-pointer list-none items-center gap-1.5 py-1 [&::-webkit-details-marker]:hidden"
      >
        <MetadataDisclosureIcon
          aria-hidden="true"
          className="metadata-disclosure-icon size-4 shrink-0 text-muted-foreground transition-transform"
        />
        <span className="text-label-compact break-words text-muted-foreground">
          {label}
        </span>
        <span className="text-supporting text-muted-foreground">{count}</span>
      </summary>
      <div className="mb-1 ml-1 min-w-0 border-l pl-3">
        <MetadataEntries
          entries={displayedEntries}
          expandedPaths={expandedPaths}
          onExpandedChange={onExpandedChange}
          path={path}
          searchQuery={searchQuery}
        />
        {remainingItems > 0 ? (
          <Button
            className="mt-1"
            onClick={() =>
              setVisibleArrayItems((current) => current + arrayPageSize)
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            Show {Math.min(arrayPageSize, remainingItems)} more
          </Button>
        ) : null}
      </div>
    </details>
  )
}

function MetadataInlineArray({
  value,
}: {
  value: readonly WorkspaceMetadataValue[]
}) {
  if (value.length === 0) {
    return <span className="font-mono text-body text-muted-foreground">[]</span>
  }
  return (
    <span className="font-mono text-body break-words">
      [{value.map(compactScalar).join(", ")}]
    </span>
  )
}

function MetadataScalar({ value }: { value: WorkspaceMetadataValue }) {
  if (value === null) {
    return (
      <span className="font-mono text-body text-muted-foreground">Null</span>
    )
  }
  if (typeof value === "string") {
    if (value.length === 0) {
      return (
        <span className="font-mono text-body text-muted-foreground">
          Empty string
        </span>
      )
    }
    return (
      <span className="font-mono text-body break-words whitespace-pre-wrap">
        {value}
      </span>
    )
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="font-mono text-body">{String(value)}</span>
  }
  return null
}

function compactScalar(value: WorkspaceMetadataValue) {
  if (typeof value === "string") return JSON.stringify(value)
  if (value === null) return "null"
  return String(value)
}

function filterEntries(
  entries: readonly MetadataEntry[],
  searchQuery: string
): readonly MetadataEntry[] {
  if (!searchQuery) return entries
  return entries.filter(
    ([key, value]) =>
      keyMatches(key, searchQuery) || valueMatches(value, searchQuery)
  )
}

function keyMatches(key: string, searchQuery: string) {
  return searchQuery.length > 0 && key.toLocaleLowerCase().includes(searchQuery)
}

function valueMatches(
  value: WorkspaceMetadataValue,
  searchQuery: string
): boolean {
  if (isMetadataArray(value)) {
    return value.some((nested) => valueMatches(nested, searchQuery))
  }
  if (isMetadataObject(value)) {
    return Object.entries(value).some(
      ([key, nested]) =>
        keyMatches(key, searchQuery) || valueMatches(nested, searchQuery)
    )
  }
  return String(value).toLocaleLowerCase().includes(searchQuery)
}

function expandablePaths(
  entries: readonly MetadataEntry[],
  path: readonly string[] = [],
  rootOnly = false
) {
  const paths: string[] = []
  for (const [key, value] of entries) {
    if (!isExpandableCollection(value)) continue
    const entriesForValue = metadataEntries(value)
    const childPath = [...path, key]
    paths.push(metadataPath(childPath))
    if (!rootOnly) {
      paths.push(...expandablePaths(entriesForValue, childPath))
    }
  }
  return paths
}

function arrayEntries(value: readonly WorkspaceMetadataValue[]) {
  return value.map((item, index) => [String(index + 1), item] as const)
}

function metadataEntries(
  metadata: WorkspaceMetadataValue | undefined
): readonly MetadataEntry[] {
  if (metadata === undefined) return []
  if (isMetadataArray(metadata)) return arrayEntries(metadata)
  if (isMetadataObject(metadata)) return sortedEntries(metadata)
  return []
}

function metadataPath(path: readonly string[]) {
  return JSON.stringify(path)
}

function isEmptyValue(value: WorkspaceMetadataValue) {
  if (isMetadataArray(value)) return value.length === 0
  if (isMetadataObject(value)) return Object.keys(value).length === 0
  return false
}

function isExpandableCollection(value: WorkspaceMetadataValue) {
  if (isMetadataObject(value)) return Object.keys(value).length > 0
  return isMetadataArray(value) && !isCompactScalarArray(value)
}

function isCompactScalarArray(
  value: WorkspaceMetadataValue
): value is readonly (boolean | null | number | string)[] {
  return (
    isMetadataArray(value) &&
    value.length <= compactArrayLimit &&
    value.every((item) => !isMetadataArray(item) && !isMetadataObject(item))
  )
}

function isMetadataArray(
  value: WorkspaceMetadataValue
): value is readonly WorkspaceMetadataValue[] {
  return Array.isArray(value)
}

function isMetadataObject(
  value: WorkspaceMetadataValue
): value is Readonly<Record<string, WorkspaceMetadataValue>> {
  return typeof value === "object" && value !== null && !isMetadataArray(value)
}

function sortedEntries(
  value: Readonly<Record<string, WorkspaceMetadataValue>>
) {
  return Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right)
  )
}

function fieldCount(count: number, label: string) {
  return `${count} ${label}${count === 1 ? "" : "s"}`
}

function itemCount(count: number) {
  return `${count} item${count === 1 ? "" : "s"}`
}
