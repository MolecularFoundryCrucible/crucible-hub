import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  AvailabilityAvailableIcon,
  AvailabilityTakenIcon,
  CloseIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  ServerIcon,
} from "@/components/crucible/icons"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { getSystemStatus } from "@/data/crucible/system-status.functions"
import { systemStatusQueryOptions } from "@/data/crucible/system-status.queries"
import type { ServiceStatus } from "@/data/crucible/system-status"
import { hubBuild } from "@/lib/build-info"
import type { HubBuild } from "@/lib/build-info"
import { cn } from "@/lib/utils"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { RefreshButton } from "@/components/crucible/refresh-button"

function statusBadgeLabel(status: ServiceStatus) {
  if (status === "ok") return "Operational"
  if (status === "degraded") return "Degraded"
  return "Unreachable"
}

function StatusMark({
  label,
  tone,
}: {
  label: string
  tone: "success" | "warning" | "destructive"
}) {
  const Icon =
    tone === "success" ? AvailabilityAvailableIcon : AvailabilityTakenIcon
  return (
    <span className="inline-flex shrink-0" title={label}>
      <Icon
        aria-hidden="true"
        className={cn(
          "size-4",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "destructive" && "text-destructive"
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

function serviceTone(status: ServiceStatus) {
  if (status === "ok") return "success" as const
  if (status === "degraded") return "warning" as const
  return "destructive" as const
}

function databaseTone(status: "ok" | "error" | "unknown") {
  if (status === "ok") return "success" as const
  if (status === "error") return "destructive" as const
  return "warning" as const
}

function databaseBadgeLabel(status: "ok" | "error" | "unknown") {
  if (status === "ok") return "Connected"
  if (status === "error") return "Error"
  return "Unknown"
}

interface SystemStatusPopoverProps {
  build?: HubBuild
  className?: string
}

export function SystemStatusPopover({
  build = hubBuild,
  className,
}: SystemStatusPopoverProps) {
  const [open, setOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const queryClient = useQueryClient()

  const statusQuery = useQuery(systemStatusQueryOptions())
  const isFetching = statusQuery.isFetching || refreshing

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const fresh = await getSystemStatus({ data: { bypassCache: true } })
      queryClient.setQueryData(crucibleKeys.systemStatus(), fresh)
    } catch {
      await statusQuery.refetch()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={
          statusQuery.data
            ? `API status: ${statusBadgeLabel(statusQuery.data.status)}`
            : "API status"
        }
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-sm py-1 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 translate-y-px rounded-full ring-1 ring-border/60",
            statusQuery.data?.status === "ok" && "bg-success",
            statusQuery.data?.status === "degraded" && "bg-warning",
            statusQuery.data?.status === "unreachable" && "bg-destructive",
            !statusQuery.data && "bg-muted-foreground/40"
          )}
        />
        <span>API status</span>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="top"
        className="flex w-80 flex-col gap-3 p-4 text-body sm:w-96"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <PopoverTitle className="text-label text-foreground">
              System Status
            </PopoverTitle>
            <PopoverDescription className="text-supporting text-muted-foreground">
              Readiness probe diagnostics
            </PopoverDescription>
          </div>
          <div className="flex items-center gap-1.5">
            {statusQuery.data ? (
              <StatusMark
                label={statusBadgeLabel(statusQuery.data.status)}
                tone={serviceTone(statusQuery.data.status)}
              />
            ) : null}
            <PopoverClose
              render={
                <Button aria-label="Close" size="icon-xs" variant="ghost" />
              }
            >
              <CloseIcon aria-hidden="true" />
            </PopoverClose>
          </div>
        </div>

        {statusQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-supporting text-muted-foreground">
            <PendingIcon />
            <span>Checking system readiness...</span>
          </div>
        ) : null}

        {statusQuery.isError && !statusQuery.data ? (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-supporting text-destructive">
            <p>Failed to query system status.</p>
            <div>
              <Button
                disabled={isFetching}
                size="xs"
                variant="outline"
                onClick={() => void handleRefresh()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        {statusQuery.data ? (
          <>
            <div aria-live="polite" className="sr-only">
              System status: {statusBadgeLabel(statusQuery.data.status)}.
              Database {databaseBadgeLabel(statusQuery.data.database.status)}.
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <ServerIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-label-compact text-foreground">
                      API
                    </span>
                    {statusQuery.data.api.url ? (
                      <span className="font-mono text-supporting break-all text-muted-foreground">
                        {statusQuery.data.api.url}
                      </span>
                    ) : null}
                    <span className="text-supporting text-muted-foreground">
                      {statusQuery.data.api.latencyMs != null
                        ? `${statusQuery.data.api.latencyMs} ms`
                        : "Unknown latency"}
                      {statusQuery.data.api.version
                        ? ` • v${statusQuery.data.api.version}`
                        : null}
                    </span>
                  </div>
                </div>
                <StatusMark
                  label={statusBadgeLabel(statusQuery.data.api.status)}
                  tone={serviceTone(statusQuery.data.api.status)}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <DatabaseIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <div className="flex flex-col">
                    <span className="text-label-compact text-foreground">
                      Database
                    </span>
                    <span className="text-supporting text-muted-foreground">
                      {statusQuery.data.database.latencyMs != null
                        ? `${statusQuery.data.database.latencyMs} ms`
                        : "Unknown latency"}
                      {statusQuery.data.database.schemaRevisions.length > 0
                        ? ` • ${
                            statusQuery.data.database.schemaRevisions[
                              statusQuery.data.database.schemaRevisions.length -
                                1
                            ]
                          }`
                        : null}
                    </span>
                  </div>
                </div>
                <StatusMark
                  label={databaseBadgeLabel(statusQuery.data.database.status)}
                  tone={databaseTone(statusQuery.data.database.status)}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                <div className="flex flex-col">
                  <span className="text-label-compact text-foreground">
                    Hub
                  </span>
                  <span className="font-mono text-supporting text-muted-foreground">
                    v{build.version}
                    {build.commit ? ` • ${build.commit}` : null}
                  </span>
                </div>
              </div>

              <details className="group border-t border-border pt-1">
                <summary className="cursor-pointer text-supporting text-muted-foreground underline underline-offset-4 transition-colors outline-none select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                  Diagnostic payload
                </summary>
                <pre className="mt-1.5 max-h-36 overflow-auto rounded-md bg-muted/50 p-2 font-mono text-supporting text-foreground">
                  {JSON.stringify(statusQuery.data, null, 2)}
                </pre>
              </details>

              <div className="flex items-center justify-between border-t border-border pt-1">
                <span className="text-supporting text-muted-foreground">
                  Checked <LocalDateTime value={statusQuery.data.timestamp} />
                </span>
                <div className="flex items-center gap-2">
                  <a
                    className="inline-flex items-center gap-1 rounded-sm text-supporting text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    href="/hub/health"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Hub health
                    <ExternalLinkIcon aria-hidden="true" className="size-4" />
                  </a>
                  <RefreshButton
                    onClick={() => void handleRefresh()}
                    refreshing={isFetching}
                    size="xs"
                  />
                </div>
              </div>
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
