import {
  CredentialIcon,
  RotateCredentialIcon,
} from "@/components/crucible/icons"
import { ActivityTime } from "@/components/crucible/activity-time"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
  return (
    <Button
      disabled={disabled || pending}
      onClick={onClick}
      size="sm"
      type="button"
      variant="outline"
    >
      {pending ? (
        <PendingIcon data-icon="inline-start" />
      ) : (
        <RotateCredentialIcon aria-hidden="true" data-icon="inline-start" />
      )}
      {label}
    </Button>
  )
}

export function ApiCredentialCard({
  action,
  error,
  lastActiveAt,
  loading = false,
  onRetry,
  status,
}: {
  action?: React.ReactNode
  error?: React.ReactNode
  lastActiveAt: string | null | undefined
  loading?: boolean
  onRetry?: () => void
  status?: WorkspaceApiCredentialStatus | null
}) {
  return (
    <Card aria-busy={loading}>
      <CardHeader actionLayout="inline">
        <CardTitle className="flex items-center gap-2">
          <CredentialIcon aria-hidden="true" />
          Security
        </CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <CredentialStatusSkeleton />
        ) : (
          <CredentialStatus
            lastActiveAt={lastActiveAt}
            status={error ? null : status}
            unavailable={Boolean(error)}
          />
        )}
        {!loading && error ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body text-muted-foreground" role="alert">
              {error}
            </p>
            {onRetry ? (
              <Button
                onClick={onRetry}
                size="sm"
                type="button"
                variant="outline"
              >
                Try again
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function LastActiveField({ value }: { value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-muted-foreground">Last active</dt>
      <dd className="mt-1 text-body">
        <ActivityTime fallback="Never" value={value} />
      </dd>
    </div>
  )
}

function CredentialStatus({
  lastActiveAt,
  status,
  unavailable,
}: {
  lastActiveAt: string | null | undefined
  status: WorkspaceApiCredentialStatus | null | undefined
  unavailable: boolean
}) {
  const empty = <span className="text-muted-foreground">-</span>
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <LastActiveField value={lastActiveAt} />
      <div className="min-w-0">
        <dt className="text-label text-muted-foreground">Key last used</dt>
        <dd className="mt-1 text-body">
          {status ? (
            <ActivityTime fallback="Not used yet" value={status.last_used_at} />
          ) : (
            empty
          )}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-label text-muted-foreground">Key status</dt>
        <dd className="mt-1">
          {status ? (
            <Badge variant={status.valid ? "success" : "destructive"}>
              {status.valid ? "Valid" : "Invalid"}
            </Badge>
          ) : unavailable ? (
            empty
          ) : (
            <Badge variant="outline">No key</Badge>
          )}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-label text-muted-foreground">Key created</dt>
        <dd className="mt-1 text-body">
          {status ? <LocalDateTime value={status.created_at} /> : empty}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-label text-muted-foreground">Key expires</dt>
        <dd className="mt-1 text-body">
          {status ? <LocalDateTime value={status.expires_at} /> : empty}
        </dd>
      </div>
    </dl>
  )
}

function CredentialStatusSkeleton() {
  const fields = [
    "Last active",
    "Key last used",
    "Key status",
    "Key created",
    "Key expires",
  ] as const
  return (
    <dl
      aria-label="Loading security details"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3"
      role="status"
    >
      {fields.map((field) => (
        <div className="min-w-0" key={field}>
          <dt className="text-label text-muted-foreground">{field}</dt>
          <dd className="mt-1">
            <Skeleton className="h-5 w-28" />
          </dd>
        </div>
      ))}
    </dl>
  )
}
