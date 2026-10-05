import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  DatabaseIcon,
  RefreshResourceIcon,
  SavingChangesIcon,
  ServerIcon,
  SystemHealthIcon,
} from "@/components/crucible/icons"
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
import { systemStatusQueryOptions } from "@/data/crucible/system-status.queries"
import type { ServiceStatus } from "@/data/crucible/system-status"

function statusBadgeVariant(status?: ServiceStatus | "unknown" | "error") {
  if (status === "ok") return "success"
  if (status === "degraded") return "warning"
  return "destructive"
}

export function SystemDiagnosticsCard() {
  const [bypassing, setBypassing] = useState(false)
  const statusQuery = useQuery(
    systemStatusQueryOptions({ bypassCache: bypassing })
  )

  async function handleRefresh() {
    setBypassing(true)
    await statusQuery.refetch()
    setBypassing(false)
  }

  const data = statusQuery.data

  return (
    <Card aria-busy={statusQuery.isFetching}>
      <CardHeader actionLayout="inline">
        <CardTitle className="flex items-center gap-2">
          <SystemHealthIcon aria-hidden="true" />
          System Diagnostics
        </CardTitle>
        <CardAction>
          <Button
            disabled={statusQuery.isFetching}
            onClick={() => void handleRefresh()}
            size="sm"
            type="button"
            variant="outline"
          >
            {statusQuery.isFetching ? (
              <SavingChangesIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <RefreshResourceIcon data-icon="inline-start" />
            )}
            Refresh probe
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {statusQuery.isPending && !data ? (
          <p className="text-body text-muted-foreground">
            Probing system health...
          </p>
        ) : statusQuery.isError && !data ? (
          <p className="text-body text-destructive" role="alert">
            System diagnostics probe failed. The API may be unreachable.
          </p>
        ) : data ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
              <div className="flex items-center gap-3">
                <span className="text-label text-muted-foreground">
                  Overall status
                </span>
                <Badge variant={statusBadgeVariant(data.status)}>
                  {data.status.toUpperCase()}
                </Badge>
              </div>
              <div className="text-body text-muted-foreground">
                Last checked: <LocalDateTime value={data.timestamp} />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-label">
                    <ServerIcon
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                    Crucible API
                  </div>
                  <Badge variant={statusBadgeVariant(data.api.status)}>
                    {data.api.status}
                  </Badge>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-body">
                  <div>
                    <dt className="text-label text-muted-foreground">
                      Version
                    </dt>
                    <dd className="font-mono">
                      {data.api.version ?? "unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-label text-muted-foreground">
                      Latency
                    </dt>
                    <dd className="font-mono">
                      {data.api.latencyMs !== undefined
                        ? `${data.api.latencyMs} ms`
                        : "n/a"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-label text-muted-foreground">
                      Git commit
                    </dt>
                    <dd className="truncate font-mono">
                      {data.api.commit
                        ? data.api.commit.slice(0, 8)
                        : "unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-label text-muted-foreground">Branch</dt>
                    <dd className="truncate font-mono">
                      {data.api.branch ?? "unknown"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-label">
                    <DatabaseIcon
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                    Database
                  </div>
                  <Badge variant={statusBadgeVariant(data.database.status)}>
                    {data.database.status}
                  </Badge>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-body">
                  <div>
                    <dt className="text-label text-muted-foreground">
                      Query latency
                    </dt>
                    <dd className="font-mono">
                      {data.database.latencyMs !== null &&
                      data.database.latencyMs !== undefined
                        ? `${data.database.latencyMs} ms`
                        : "n/a"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-label text-muted-foreground">
                      Hub revision
                    </dt>
                    <dd className="truncate font-mono">
                      {data.hub.revision ?? "unknown"}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-label text-muted-foreground">
                      Schema revisions
                    </dt>
                    <dd className="mt-1 flex flex-wrap gap-1">
                      {data.database.schemaRevisions.length > 0 ? (
                        data.database.schemaRevisions.map((rev) => (
                          <Badge
                            className="font-mono"
                            key={rev}
                            variant="secondary"
                          >
                            {rev}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">
                          None reported
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
