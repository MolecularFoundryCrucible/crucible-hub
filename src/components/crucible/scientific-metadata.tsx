import type { WorkspaceMetadataValue } from "@/data/crucible/workspace-source"

const initialFieldLimit = 6

export function ScientificMetadata({
  emptyMessage = "No scientific metadata is available.",
  metadata,
}: {
  emptyMessage?: string
  metadata: WorkspaceMetadataValue | undefined
}) {
  if (metadata === null || metadata === undefined || isEmptyValue(metadata)) {
    return <p className="text-body text-muted-foreground">{emptyMessage}</p>
  }

  if (!isMetadataObject(metadata)) {
    return <MetadataValue value={metadata} />
  }

  const entries = sortedEntries(metadata)
  const initialEntries = entries.slice(0, initialFieldLimit)
  const additionalEntries = entries.slice(initialFieldLimit)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <MetadataFields entries={initialEntries} />
      {additionalEntries.length > 0 && (
        <details className="min-w-0 border-t pt-3">
          <summary className="cursor-pointer text-label text-muted-foreground">
            {fieldCount(additionalEntries.length, "additional field")}
          </summary>
          <div className="mt-3">
            <MetadataFields entries={additionalEntries} />
          </div>
        </details>
      )}
    </div>
  )
}

function MetadataFields({
  entries,
}: {
  entries: readonly [string, WorkspaceMetadataValue][]
}) {
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div className="min-w-0" key={key}>
          <dt className="text-supporting break-words text-muted-foreground">
            {key}
          </dt>
          <dd className="mt-1 min-w-0">
            <MetadataValue label={key} value={value} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function MetadataValue({
  label,
  value,
}: {
  label?: string
  value: WorkspaceMetadataValue
}) {
  if (value === null) {
    return <span className="text-body text-muted-foreground">Null</span>
  }
  if (typeof value === "string") {
    if (value.length === 0) {
      return (
        <span className="text-body text-muted-foreground">Empty string</span>
      )
    }
    return (
      <span className="text-body break-words whitespace-pre-wrap">{value}</span>
    )
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="text-body">{String(value)}</span>
  }
  if (isMetadataArray(value)) {
    if (value.length === 0) {
      return <span className="text-body text-muted-foreground">Empty list</span>
    }
    const count = itemCount(value.length)
    return (
      <details className="min-w-0">
        <summary
          aria-label={label ? `${label}: ${count}` : count}
          className="cursor-pointer text-label text-muted-foreground"
        >
          {count}
        </summary>
        <ol className="mt-3 flex min-w-0 flex-col gap-3 border-l pl-3">
          {value.map((item, index) => (
            <li className="flex min-w-0 gap-2" key={index}>
              <span className="shrink-0 text-supporting text-muted-foreground">
                {index + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <MetadataValue label={`Item ${index + 1}`} value={item} />
              </div>
            </li>
          ))}
        </ol>
      </details>
    )
  }

  const entries = sortedEntries(value)
  if (entries.length === 0) {
    return <span className="text-body text-muted-foreground">Empty object</span>
  }
  const count = fieldCount(entries.length, "field")
  return (
    <details className="min-w-0">
      <summary
        aria-label={label ? `${label}: ${count}` : count}
        className="cursor-pointer text-label text-muted-foreground"
      >
        {count}
      </summary>
      <div className="mt-3 border-l pl-3">
        <MetadataFields entries={entries} />
      </div>
    </details>
  )
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
