import { RotateCredentialIcon } from "@/components/crucible/icons"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useDelayedFlag } from "@/hooks/use-delayed-flag"
import type { WorkspaceApiCredentialStatus } from "@/data/crucible/workspace-source"

export function RotateCredentialAction({
  disabled = false,
  label,
  onClick,
  pending = false,
}: {
  disabled?: boolean
  label: string
  onClick: () => void
  pending?: boolean
}) {
  const showPending = useDelayedFlag(pending)
  return (
    <Button
      disabled={disabled || pending}
      onClick={onClick}
      size="sm"
      type="button"
      variant="outline"
    >
      {showPending ? (
        <PendingIcon data-icon="inline-start" />
      ) : (
        <RotateCredentialIcon aria-hidden="true" data-icon="inline-start" />
      )}
      {label}
    </Button>
  )
}

export function ApiKeyStatusBadge({
  status,
}: {
  status: WorkspaceApiCredentialStatus | null | undefined
}) {
  if (!status) return <Badge variant="outline">No key</Badge>
  return (
    <Badge variant={status.valid ? "success" : "destructive"}>
      {status.valid ? "Valid" : "Invalid"}
    </Badge>
  )
}
