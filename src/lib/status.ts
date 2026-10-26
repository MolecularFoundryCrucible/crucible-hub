export type StatusTone =
  "destructive" | "info" | "outline" | "secondary" | "success" | "warning"

/** Kinds of record whose statuses read and color differently. */
export type StatusDomain =
  "database" | "deletion-request" | "ingestion" | "resource" | "service"

type StatusEntry = { label?: string; tone: StatusTone }

const catalogue: Record<StatusDomain, Partial<Record<string, StatusEntry>>> = {
  database: {
    error: { tone: "destructive" },
    ok: { label: "Connected", tone: "success" },
    unknown: { tone: "warning" },
  },
  "deletion-request": {
    approved: { tone: "success" },
    pending: { tone: "warning" },
    rejected: { tone: "destructive" },
  },
  ingestion: {
    complete: { tone: "success" },
    completed: { tone: "success" },
    error: { tone: "destructive" },
    failed: { tone: "destructive" },
    "in progress": { tone: "info" },
    pending: { tone: "info" },
    processing: { tone: "info" },
    queued: { tone: "info" },
    requested: { tone: "info" },
    retrying: { tone: "warning" },
    running: { tone: "info" },
    success: { tone: "success" },
  },
  resource: {
    active: { tone: "success" },
    approved: { tone: "success" },
    archived: { tone: "secondary" },
    closed: { tone: "secondary" },
    completed: { tone: "secondary" },
    decommissioned: { tone: "destructive" },
    degraded: { tone: "warning" },
    draft: { tone: "secondary" },
    error: { tone: "destructive" },
    failed: { tone: "destructive" },
    maintenance: { tone: "warning" },
    pending: { tone: "warning" },
    ready: { tone: "success" },
    rejected: { tone: "destructive" },
  },
  service: {
    degraded: { tone: "warning" },
    ok: { label: "Operational", tone: "success" },
    unreachable: { tone: "destructive" },
  },
}

function statusKey(status: string) {
  return status
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, " ")
}

/** The sentence-case label for an API status, e.g. `in_progress` as "In progress". */
export function statusLabel(domain: StatusDomain, status: string) {
  const key = statusKey(status)
  const label = catalogue[domain][key]?.label ?? key
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function statusTone(domain: StatusDomain, status: string): StatusTone {
  return catalogue[domain][statusKey(status)]?.tone ?? "outline"
}
