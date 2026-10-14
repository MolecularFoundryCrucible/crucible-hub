import { CredentialIcon } from "@/components/crucible/icons"
import { LocalDateTime } from "@/components/crucible/local-date-time"
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

export function ApiCredentialCard({
  action,
  error,
  loading = false,
  onRetry,
  status,
}: {
  action?: React.ReactNode
  error?: React.ReactNode
  loading?: boolean
  onRetry?: () => void
  status?: WorkspaceApiCredentialStatus | null
}) {
  return (
    <Card aria-busy={loading}>
      <CardHeader actionLayout="inline">
        <CardTitle className="flex items-center gap-2">
          <CredentialIcon aria-hidden="true" />
          API credential
        </CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <CredentialStatusSkeleton />
        ) : error ? (
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
        ) : status ? (
          <CredentialStatus status={status} />
        ) : (
          <p className="text-body text-muted-foreground">
            No API credential status is available.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function CredentialStatus({
  status,
}: {
  status: WorkspaceApiCredentialStatus
}) {
  return (
    <dl className="grid grid-cols-2 gap-4 xl:grid-cols-3">
      <div className="col-span-2 min-w-0 xl:col-span-1">
        <dt className="text-label text-muted-foreground">Status</dt>
        <dd className="mt-1">
          <Badge variant={status.valid ? "success" : "destructive"}>
            {status.valid ? "Valid" : "Invalid"}
          </Badge>
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-label text-muted-foreground">Created</dt>
        <dd className="mt-1 text-body">
          <LocalDateTime value={status.created_at} />
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-label text-muted-foreground">Expires</dt>
        <dd className="mt-1 text-body">
          <LocalDateTime value={status.expires_at} />
        </dd>
      </div>
    </dl>
  )
}

function CredentialStatusSkeleton() {
  const fields = ["Status", "Created", "Expires"] as const
  return (
    <dl
      aria-label="Loading API credential status"
      className="grid grid-cols-2 gap-4 xl:grid-cols-3"
      role="status"
    >
      {fields.map((field, index) => (
        <div
          className={
            index === 0 ? "col-span-2 min-w-0 xl:col-span-1" : "min-w-0"
          }
          key={field}
        >
          <dt className="text-label text-muted-foreground">{field}</dt>
          <dd className="mt-1">
            <Skeleton className="h-5 w-28" />
          </dd>
        </div>
      ))}
    </dl>
  )
}
