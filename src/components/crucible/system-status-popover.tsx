import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  AvailabilityAvailableIcon,
  AvailabilityTakenIcon,
  CloseIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  HubApplicationIcon,
  ServerIcon,
} from "@/components/crucible/icons"
import { Disclosure, DisclosureSummary } from "@/components/crucible/disclosure"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { getSystemStatus } from "@/data/crucible/system-status.functions"
import { systemStatusQueryOptions } from "@/data/crucible/system-status.queries"
import { hubBuild } from "@/lib/build-info"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { statusLabel, statusTone } from "@/lib/status"
import type { StatusDomain } from "@/lib/status"
import type { HubBuild } from "@/lib/build-info"
import { cn } from "@/lib/utils"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { RefreshButton } from "@/components/crucible/refresh-button"

function StatusMark({
  domain,
  status,
}: {
  domain: StatusDomain
  status: string
}) {
  const tone = statusTone(domain, status)
  const label = statusLabel(domain, status)
  const Icon =
    tone === "success" ? AvailabilityAvailableIcon : AvailabilityTakenIcon
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
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
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function StatusRow({
  action,
  children,
  icon: Icon,
  title,
}: {
  action: React.ReactNode
  children: React.ReactNode
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <Icon
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <div className="flex min-w-0 flex-col">
          <span className="text-label">{title}</span>
          {children}
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  )
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
            ? `API status: ${statusLabel("service", statusQuery.data.status)}`
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
        <div className="flex items-center justify-between gap-2">
          <PopoverTitle className="text-title-section">
            System status
          </PopoverTitle>
          <PopoverClose
            render={
              <Button aria-label="Close" size="icon-xs" variant="ghost" />
            }
          >
            <CloseIcon aria-hidden="true" />
          </PopoverClose>
        </div>

        {statusQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-supporting text-muted-foreground">
            <PendingIcon />
            <span>Checking status…</span>
          </div>
        ) : null}

        {statusQuery.isError && !statusQuery.data ? (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-supporting text-destructive">
            <p>The system status could not be checked.</p>
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
              System status: {statusLabel("service", statusQuery.data.status)}.
              Database{" "}
              {statusLabel("database", statusQuery.data.database.status)}.
            </div>
            <ul className="-my-2.5 flex flex-col divide-y divide-border">
              <StatusRow
                action={
                  <StatusMark
                    domain="service"
                    status={statusQuery.data.api.status}
                  />
                }
                icon={ServerIcon}
                title="API"
              >
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
              </StatusRow>
              <StatusRow
                action={
                  <StatusMark
                    domain="database"
                    status={statusQuery.data.database.status}
                  />
                }
                icon={DatabaseIcon}
                title="Database"
              >
                <span className="text-supporting break-all text-muted-foreground">
                  {statusQuery.data.database.latencyMs != null
                    ? `${statusQuery.data.database.latencyMs} ms`
                    : "Unknown latency"}
                  {statusQuery.data.database.schemaRevisions.length > 0
                    ? ` • ${statusQuery.data.database.schemaRevisions.at(-1)}`
                    : null}
                </span>
              </StatusRow>
              <StatusRow
                action={
                  <a
                    className={buttonVariants({ size: "xs", variant: "ghost" })}
                    href="/hub/health"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Hub health
                    <ExternalLinkIcon
                      aria-hidden="true"
                      data-icon="inline-end"
                    />
                  </a>
                }
                icon={HubApplicationIcon}
                title="Hub"
              >
                <span className="text-supporting text-muted-foreground">
                  v{build.version}
                  {build.commit ? ` • ${build.commit}` : null}
                </span>
              </StatusRow>
            </ul>

            <Disclosure className="border-t border-border pt-1">
              <DisclosureSummary className="text-supporting text-muted-foreground hover:text-foreground">
                <span>Diagnostic payload</span>
              </DisclosureSummary>
              <pre className="mt-1.5 max-h-36 overflow-auto rounded-md bg-muted/50 p-2 font-mono text-supporting text-foreground">
                {JSON.stringify(statusQuery.data, null, 2)}
              </pre>
            </Disclosure>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-1">
              <span className="text-supporting text-muted-foreground">
                Checked <LocalDateTime value={statusQuery.data.timestamp} />
              </span>
              <RefreshButton
                onClick={() => void handleRefresh()}
                refreshing={isFetching}
                size="xs"
              />
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
