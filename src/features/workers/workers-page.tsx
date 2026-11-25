import { useQuery, useSuspenseQuery } from "@tanstack/react-query"

import { ActivityTime } from "@/components/crucible/activity-time"
import { AdministrationUnavailable } from "@/components/crucible/administrator-view-required"
import {
  CollectionLoadError,
  TablePending,
} from "@/components/crucible/collection-state"
import { Disclosure, DisclosureSummary } from "@/components/crucible/disclosure"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { RefreshButton } from "@/components/crucible/refresh-button"
import {
  useAdministrationScope,
  useWorkspacePrivilegeMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { canOpenPlatformAdministration } from "@/data/crucible/administration"
import { storesQueryOptions } from "@/data/crucible/resources.queries"
import { workersQueryOptions } from "@/data/crucible/workers.queries"
import type {
  WorkspaceStore,
  WorkspaceWorker,
} from "@/data/crucible/workspace-source"

const title = "Ingestion workers"

const pendingColumns = [
  { label: "Worker" },
  { label: "Status" },
  { label: "Last seen" },
  { className: "hidden @3xl:table-cell", label: "Versions" },
  { className: "hidden @3xl:table-cell", label: "Stores" },
]

export function WorkersPage() {
  const scope = useWorkspaceScope()
  const administrationScope = useAdministrationScope()
  const privilegeMode = useWorkspacePrivilegeMode()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const allowed = canOpenPlatformAdministration(account, privilegeMode)
  const workers = useQuery({
    ...workersQueryOptions(administrationScope),
    enabled: allowed,
  })
  const stores = useQuery({ ...storesQueryOptions(scope), enabled: allowed })

  if (!allowed) {
    return (
      <AdministrationUnavailable
        account={account}
        description="Turn on administrator view to see the ingestion workers registered with Crucible."
        title={title}
      />
    )
  }

  return (
    <PageLayout>
      <PageHeader
        actions={
          <RefreshButton
            onClick={() => void workers.refetch()}
            refreshing={workers.isFetching}
          />
        }
        description="Workers that registered in the last day. A worker stays live while it renews its registration."
        title={title}
      />
      {workers.isPending ? (
        <Card>
          <CardContent>
            <TablePending columns={pendingColumns} label="ingestion workers" />
          </CardContent>
        </Card>
      ) : workers.isError && !workers.data ? (
        <CollectionLoadError
          label="Ingestion workers"
          retry={() => void workers.refetch()}
        />
      ) : workers.data.length === 0 ? (
        <Empty className="min-h-state border">
          <EmptyHeader>
            <EmptyTitle>No ingestion workers</EmptyTitle>
            <EmptyDescription>
              Workers appear here when they register. Ingestion requests wait in
              the queue until one is running.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardContent className="@container">
            <WorkersTable stores={stores.data} workers={workers.data} />
          </CardContent>
        </Card>
      )}
    </PageLayout>
  )
}

function WorkersTable({
  stores,
  workers,
}: {
  stores: readonly WorkspaceStore[] | undefined
  workers: readonly WorkspaceWorker[]
}) {
  const sorted = [...workers].sort(
    (left, right) =>
      Number(right.live) - Number(left.live) ||
      right.last_seen_at.localeCompare(left.last_seen_at)
  )
  const storeName = (id: string) =>
    stores?.find((store) => store.id === id)?.display_name ?? id

  return (
    <Table aria-label={title}>
      <TableHeader>
        <TableRow>
          <TableHead>Worker</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last seen</TableHead>
          <TableHead className="hidden @3xl:table-cell">Versions</TableHead>
          <TableHead className="hidden @3xl:table-cell">Stores</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((worker) => (
          <TableRow className="align-top" key={worker.worker_id}>
            <TableCell className="min-w-0 whitespace-normal">
              <div className="flex flex-col gap-1">
                <span className="font-heading text-label break-all">
                  {worker.worker_id}
                </span>
                <WorkerIngestors worker={worker} />
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={worker.live ? "success" : "secondary"}>
                {worker.live ? "Live" : "Expired"}
              </Badge>
            </TableCell>
            <TableCell>
              <ActivityTime fallback="Never" value={worker.last_seen_at} />
            </TableCell>
            <TableCell className="hidden whitespace-normal @3xl:table-cell">
              <div className="flex flex-col text-supporting">
                <span>Worker {worker.worker_version ?? "unknown"}</span>
                <span className="text-muted-foreground">
                  crucible-ingestion {worker.package_version ?? "unknown"}
                </span>
              </div>
            </TableCell>
            <TableCell className="hidden whitespace-normal @3xl:table-cell">
              {worker.store_ids.length
                ? worker.store_ids.map(storeName).join(", ")
                : "None"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function WorkerIngestors({ worker }: { worker: WorkspaceWorker }) {
  const count = worker.capabilities.length
  if (count === 0) {
    return (
      <span className="text-supporting text-muted-foreground">
        No ingestors
      </span>
    )
  }
  return (
    <Disclosure>
      <DisclosureSummary className="text-supporting text-muted-foreground">
        {count} {count === 1 ? "ingestor" : "ingestors"}
      </DisclosureSummary>
      <ul className="mt-2 flex flex-col gap-1.5">
        {worker.capabilities.map((capability) => (
          <li className="flex flex-col text-supporting" key={capability.name}>
            <span>{capability.name}</span>
            {capability.description || capability.file_extensions?.length ? (
              <span className="text-muted-foreground">
                {[
                  capability.description,
                  capability.file_extensions?.join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Disclosure>
  )
}
