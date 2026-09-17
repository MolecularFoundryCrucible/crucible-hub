import { CredentialIcon } from "@/components/crucible/icons"
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
import { formatDate } from "@/lib/format"

export function ApiCredentialCard({
  action,
  error,
  loading = false,
  onRetry,
  status,
}: {
  action?: React.ReactNode
  error?: string
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
    <dl className="grid gap-4 sm:grid-cols-2">
      <div>
        <dt className="text-label text-muted-foreground">Status</dt>
        <dd className="mt-1">
          <Badge variant={status.valid ? "secondary" : "destructive"}>
            {status.valid ? "Valid" : "Invalid"}
          </Badge>
        </dd>
      </div>
      <div>
        <dt className="text-label text-muted-foreground">Created</dt>
        <dd className="mt-1 text-body">{formatDate(status.created_at)}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-label text-muted-foreground">Expires</dt>
        <dd className="mt-1 text-body">{formatDate(status.expires_at)}</dd>
      </div>
    </dl>
  )
}

function CredentialStatusSkeleton() {
  return (
    <div
      aria-label="Loading API credential status"
      className="grid gap-4 sm:grid-cols-2"
      role="status"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div className={index === 2 ? "sm:col-span-2" : undefined} key={index}>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-2 h-5 w-28" />
        </div>
      ))}
    </div>
  )
}
