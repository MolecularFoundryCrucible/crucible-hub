import { useEffect, useState } from "react"

import { MetadataDisclosureIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import type { WorkspaceMetadataValue } from "@/data/crucible/workspace-source"

const initialFieldLimit = 6
const additionalFieldsPath = '{"hub":"additional-fields"}'

type MetadataEntry = readonly [string, WorkspaceMetadataValue]

export function ScientificMetadata({
  emptyMessage = "No scientific metadata is available.",
  expandFirstLevel = false,
  metadata,
}: {
  emptyMessage?: string
  expandFirstLevel?: boolean
  metadata: WorkspaceMetadataValue | undefined
}) {
  if (metadata === null || metadata === undefined || isEmptyValue(metadata)) {
    return <p className="text-body text-muted-foreground">{emptyMessage}</p>
  }

  if (isMetadataArray(metadata)) {
    return (
      <MetadataTree
        expandFirstLevel={expandFirstLevel}
        initialEntries={arrayEntries(metadata)}
        metadata={metadata}
      />
    )
  }

  if (!isMetadataObject(metadata)) {
    return <MetadataScalar value={metadata} />
  }

  const entries = sortedEntries(metadata)
  return (
    <MetadataTree
      additionalEntries={entries.slice(initialFieldLimit)}
      expandFirstLevel={expandFirstLevel}
      initialEntries={entries.slice(0, initialFieldLimit)}
      metadata={metadata}
    />
  )
}

function MetadataTree({
  additionalEntries = [],
  expandFirstLevel,
  initialEntries,
  metadata,
}: {
  additionalEntries?: readonly MetadataEntry[]
  expandFirstLevel: boolean
  initialEntries: readonly MetadataEntry[]
  metadata: WorkspaceMetadataValue
}) {
  const allPaths = expandablePaths([...initialEntries, ...additionalEntries])
  if (additionalEntries.length > 0) allPaths.push(additionalFieldsPath)
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        expandFirstLevel
          ? expandablePaths(initialEntries, [], true)
          : ([] as string[])
      )
  )

  useEffect(() => {
    setExpandedPaths(
      new Set(
        expandFirstLevel
          ? expandablePaths(metadataInitialEntries(metadata), [], true)
          : []
      )
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

  return (
    <div className="min-w-0">
      {allPaths.length > 0 ? (
        <div className="mb-2 flex justify-end">
          <Button
            onClick={() =>
              setExpandedPaths(allExpanded ? new Set() : new Set(allPaths))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
        </div>
      ) : null}
      <MetadataEntries
        entries={initialEntries}
        expandedPaths={expandedPaths}
        onExpandedChange={setExpanded}
        path={[]}
      />
      {additionalEntries.length > 0 ? (
        <details
          className="group/more border-t"
          onToggle={(event) =>
            setExpanded(additionalFieldsPath, event.currentTarget.open)
          }
          open={expandedPaths.has(additionalFieldsPath)}
        >
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 py-2 text-label text-muted-foreground [&::-webkit-details-marker]:hidden">
            <MetadataDisclosureIcon
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform group-open/more:rotate-90"
            />
            {fieldCount(additionalEntries.length, "additional field")}
          </summary>
          <MetadataEntries
            entries={additionalEntries}
            expandedPaths={expandedPaths}
            onExpandedChange={setExpanded}
            path={[]}
          />
        </details>
      ) : null}
    </div>
  )
}

function MetadataEntries({
  entries,
  expandedPaths,
  onExpandedChange,
  path,
}: {
  entries: readonly MetadataEntry[]
  expandedPaths: ReadonlySet<string>
  onExpandedChange: (path: string, expanded: boolean) => void
  path: readonly string[]
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
  value,
}: {
  expandedPaths: ReadonlySet<string>
  name: string
  onExpandedChange: (path: string, expanded: boolean) => void
  path: readonly string[]
  value: WorkspaceMetadataValue
}) {
  if (isMetadataArray(value) || isMetadataObject(value)) {
    return (
      <div className="min-w-0 border-t first:border-t-0">
        <dt className="sr-only">{name}</dt>
        <dd className="min-w-0">
          <MetadataCollection
            expandedPaths={expandedPaths}
            label={name}
            onExpandedChange={onExpandedChange}
            path={path}
            value={value}
          />
        </dd>
      </div>
    )
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-1 border-t py-2 first:border-t-0 sm:grid-cols-3 sm:gap-3">
      <dt className="text-label break-words text-muted-foreground">{name}</dt>
      <dd className="min-w-0 sm:col-span-2">
        <MetadataScalar value={value} />
      </dd>
    </div>
  )
}

function MetadataCollection({
  expandedPaths,
  label,
  onExpandedChange,
  path,
  value,
}: {
  expandedPaths: ReadonlySet<string>
  label: string
  onExpandedChange: (path: string, expanded: boolean) => void
  path: readonly string[]
  value:
    | readonly WorkspaceMetadataValue[]
    | Readonly<Record<string, WorkspaceMetadataValue>>
}) {
  const array = isMetadataArray(value)
  const entries = array ? arrayEntries(value) : sortedEntries(value)

  if (entries.length === 0) {
    return (
      <div className="grid min-w-0 grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-3">
        <span className="text-label break-words text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-body text-muted-foreground sm:col-span-2">
          {array ? "Empty list" : "Empty object"}
        </span>
      </div>
    )
  }

  const count = array
    ? itemCount(entries.length)
    : fieldCount(entries.length, "field")
  const pathKey = metadataPath(path)

  return (
    <details
      className="metadata-disclosure min-w-0"
      onToggle={(event) => onExpandedChange(pathKey, event.currentTarget.open)}
      open={expandedPaths.has(pathKey)}
    >
      <summary
        aria-label={`${label}: ${count}`}
        className="metadata-disclosure-summary min-h-10 cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden"
      >
        <MetadataDisclosureIcon
          aria-hidden="true"
          className="metadata-disclosure-icon size-4 shrink-0 text-muted-foreground transition-transform"
        />
        <span className="text-label break-words text-muted-foreground">
          {label}
        </span>
        <span className="text-supporting text-muted-foreground">{count}</span>
      </summary>
      <div className="mb-2 ml-2 min-w-0 border-l pl-4">
        <MetadataEntries
          entries={entries}
          expandedPaths={expandedPaths}
          onExpandedChange={onExpandedChange}
          path={path}
        />
      </div>
    </details>
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

function expandablePaths(
  entries: readonly MetadataEntry[],
  path: readonly string[] = [],
  rootOnly = false
) {
  const paths: string[] = []
  for (const [key, value] of entries) {
    if (!isMetadataArray(value) && !isMetadataObject(value)) continue
    const entriesForValue = isMetadataArray(value)
      ? arrayEntries(value)
      : sortedEntries(value)
    if (entriesForValue.length === 0) continue
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

function metadataInitialEntries(
  metadata: WorkspaceMetadataValue
): readonly MetadataEntry[] {
  if (isMetadataArray(metadata)) return arrayEntries(metadata)
  if (isMetadataObject(metadata)) {
    return sortedEntries(metadata).slice(0, initialFieldLimit)
  }
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
