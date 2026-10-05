import { ResourceStatusBadge } from "./resource-status-badge"

export function InstrumentStatusBadge({
  className,
  status,
}: {
  className?: string
  status: string
}) {
  return <ResourceStatusBadge className={className} status={status} />
}
