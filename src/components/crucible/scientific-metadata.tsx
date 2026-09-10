import { MetadataDisclosureIcon } from "@/components/crucible/icons"
import type { WorkspaceMetadataValue } from "@/data/crucible/workspace-source"

const initialFieldLimit = 6

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
      <MetadataEntries
        depth={0}
        entries={metadata.map(
          (item, index) => [String(index + 1), item] as const
        )}
        expandFirstLevel={expandFirstLevel}
      />
    )
  }

  if (!isMetadataObject(metadata)) {
    return <MetadataScalar value={metadata} />
  }

  const entries = sortedEntries(metadata)
  const initialEntries = entries.slice(0, initialFieldLimit)
  const additionalEntries = entries.slice(initialFieldLimit)

  return (
    <div className="min-w-0">
      <MetadataEntries
        depth={0}
        entries={initialEntries}
        expandFirstLevel={expandFirstLevel}
      />
      {additionalEntries.length > 0 ? (
        <details className="group/more border-t">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 py-2 text-label text-muted-foreground [&::-webkit-details-marker]:hidden">
            <MetadataDisclosureIcon
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform group-open/more:rotate-90"
            />
            {fieldCount(additionalEntries.length, "additional field")}
          </summary>
          <MetadataEntries
            depth={0}
            entries={additionalEntries}
            expandFirstLevel={expandFirstLevel}
          />
        </details>
      ) : null}
    </div>
  )
}

function MetadataEntries({
  depth,
  entries,
  expandFirstLevel,
}: {
  depth: number
  entries: readonly (readonly [string, WorkspaceMetadataValue])[]
  expandFirstLevel: boolean
}) {
  return (
    <dl className="min-w-0">
      {entries.map(([key, value]) => (
        <MetadataEntry
          depth={depth}
          expandFirstLevel={expandFirstLevel}
          key={key}
          name={key}
          value={value}
        />
      ))}
    </dl>
  )
}

function MetadataEntry({
  depth,
  expandFirstLevel,
  name,
  value,
}: {
  depth: number
  expandFirstLevel: boolean
  name: string
  value: WorkspaceMetadataValue
}) {
  if (isMetadataArray(value) || isMetadataObject(value)) {
    return (
      <div className="min-w-0 border-t first:border-t-0">
        <dt className="sr-only">{name}</dt>
        <dd className="min-w-0">
          <MetadataCollection
            depth={depth}
            expandFirstLevel={expandFirstLevel}
            label={name}
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
  depth,
  expandFirstLevel,
  label,
  value,
}: {
  depth: number
  expandFirstLevel: boolean
  label: string
  value:
    | readonly WorkspaceMetadataValue[]
    | Readonly<Record<string, WorkspaceMetadataValue>>
}) {
  const array = isMetadataArray(value)
  const entries = array
    ? value.map((item, index) => [String(index + 1), item] as const)
    : sortedEntries(value)

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

  return (
    <details
      className="metadata-disclosure min-w-0"
      open={expandFirstLevel && depth === 0}
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
          depth={depth + 1}
          entries={entries}
          expandFirstLevel={expandFirstLevel}
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
