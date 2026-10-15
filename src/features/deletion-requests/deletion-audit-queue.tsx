import { useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"

import { CollectionPagination } from "@/components/crucible/collection-pagination"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidText } from "@/components/crucible/mfid-text"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { deletionAuditInfiniteQueryOptions } from "@/data/crucible/deletion-requests.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type {
  WorkspaceAccount,
  WorkspaceDeletionAudit,
  WorkspacePerson,
} from "@/data/crucible/workspace-source"
import type { WorkspaceDeletionAuditFilters } from "@/data/crucible/deletion-requests.server"

const pendingRows = ["first", "second", "third"] as const

export function DeletionAuditQueue({
  account,
  auditScope,
  scope,
}: {
  account: WorkspaceAccount
  auditScope: WorkspaceDeletionAuditFilters["scope"]
  scope: IdentityScope
}) {
  const result = useInfiniteQuery(
    deletionAuditInfiniteQueryOptions(scope, auditScope)
  )
  const [selected, setSelected] = useState<WorkspaceDeletionAudit>()
  const pages = result.data?.pages ?? []
  const items = pages.flatMap((page) => page.items)
  const total = pages.at(0)?.total ?? null

  return (
    <>
      <Card aria-busy={result.isFetching}>
        {result.isPending ? (
          <DeletionAuditPending />
        ) : result.isError && !result.data ? (
          <CardContent>
            <Empty className="min-h-40 border" role="alert">
              <EmptyHeader>
                <EmptyTitle>Deletion history could not be loaded</EmptyTitle>
              </EmptyHeader>
              <Button
                onClick={() => void result.refetch()}
                size="sm"
                variant="outline"
              >
                Retry
              </Button>
            </Empty>
          </CardContent>
        ) : items.length === 0 ? (
          <CardContent>
            <Empty className="min-h-32">
              <EmptyHeader>
                <EmptyTitle>No approved requests</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </CardContent>
        ) : (
          <CardContent className="px-0">
            {result.isRefetchError ? (
              <p className="px-4 pb-3 text-body text-destructive" role="alert">
                The history could not be refreshed. Showing the last loaded
                records.
              </p>
            ) : null}
            <DeletionAuditTable
              account={account}
              items={items}
              onOpen={setSelected}
            />
          </CardContent>
        )}
      </Card>
      <CollectionPagination
        disabled={result.isFetchingNextPage}
        hasNextPage={result.hasNextPage}
        isError={result.isFetchNextPageError}
        isLoading={result.isFetchingNextPage}
        label="approved deletion requests"
        loaded={items.length}
        onLoadMore={() => void result.fetchNextPage()}
        total={total}
      />
      <DeletionAuditDialog
        account={account}
        audit={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined)
        }}
      />
    </>
  )
}

function DeletionAuditColgroup() {
  return (
    <colgroup>
      <col className="w-deletion-resource-column-with-project" />
      <col className="w-deletion-project-column" />
      <col className="w-deletion-requester-column" />
      <col className="w-deletion-date-column" />
      <col className="w-deletion-action-column" />
    </colgroup>
  )
}

function DeletionAuditHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Resource</TableHead>
        <TableHead>Project</TableHead>
        <TableHead>Requested by</TableHead>
        <TableHead kind="date">Deleted</TableHead>
        <TableHead kind="action">
          <span className="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  )
}

function DeletionAuditPending() {
  return (
    <CardContent
      aria-label="Loading approved deletion requests"
      className="px-0"
      role="status"
    >
      <Table className="deletion-request-table table-fixed">
        <DeletionAuditColgroup />
        <DeletionAuditHeader />
        <TableBody>
          {pendingRows.map((row) => (
            <TableRow key={row}>
              <TableCell className="deletion-request-resource">
                <div className="flex min-w-0 items-center gap-2">
                  <Skeleton className="size-5 shrink-0 rounded-sm" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              </TableCell>
              <TableCell
                className="deletion-request-project"
                data-label="Project"
              >
                <Skeleton className="h-4 w-3/4" />
              </TableCell>
              <TableCell
                className="deletion-request-requester"
                data-label="Requested by"
              >
                <Skeleton className="h-4 w-3/4" />
              </TableCell>
              <TableCell
                className="deletion-request-date"
                data-label="Deleted"
                kind="date"
              >
                <Skeleton className="h-4 w-4/5" />
              </TableCell>
              <TableCell kind="action" className="deletion-request-action">
                <Skeleton className="mx-auto h-7 w-16 rounded-lg" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  )
}

function DeletionAuditTable({
  account,
  items,
  onOpen,
}: {
  account: WorkspaceAccount
  items: readonly WorkspaceDeletionAudit[]
  onOpen: (audit: WorkspaceDeletionAudit) => void
}) {
  return (
    <Table
      aria-label="Approved deletion requests"
      className="deletion-request-table table-fixed"
    >
      <DeletionAuditColgroup />
      <DeletionAuditHeader />
      <TableBody>
        {items.map((audit) => (
          <TableRow key={audit.id}>
            <TableCell className="deletion-request-resource">
              <ResourceIdentity
                kind={resourceKind(audit.resource_type)}
                mfid={audit.resource_id}
                name={audit.resource_name?.trim() || "Untitled resource"}
                presentation="collection"
              />
            </TableCell>
            <TableCell
              className="deletion-request-project"
              data-label="Project"
            >
              <AuditProject audit={audit} />
            </TableCell>
            <TableCell
              className="deletion-request-requester"
              data-label="Requested by"
            >
              <AuditIdentity
                account={account}
                mfid={audit.requester_id}
                person={audit.requester}
              />
            </TableCell>
            <TableCell
              kind="date"
              className="deletion-request-date"
              data-label="Deleted"
            >
              <LocalDateTime value={audit.deleted_at} />
            </TableCell>
            <TableCell kind="action" className="deletion-request-action">
              <Button onClick={() => onOpen(audit)} size="sm" variant="outline">
                View
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function AuditIdentity({
  account,
  mfid,
  person,
}: {
  account: WorkspaceAccount
  mfid: string
  person?: WorkspacePerson | null
}) {
  const identity = person ?? (mfid === account.unique_id ? account : undefined)
  if (identity)
    return (
      <PersonLink
        nameStyle="abbreviated"
        person={identity}
        presentation="collection"
      />
    )
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <PrincipalTypeIcon type="user" />
      <MfidText className="truncate" presentation="supporting" value={mfid} />
    </span>
  )
}

function AuditProject({ audit }: { audit: WorkspaceDeletionAudit }) {
  const projectId = audit.project_id?.trim()
  if (!projectId)
    return <span className="text-muted-foreground">Not assigned</span>
  if (!audit.project_mfid) return <span className="truncate">{projectId}</span>
  return (
    <ResourceIdentityLink
      kind="project"
      mfid={audit.project_mfid}
      name={projectId}
      showTypeIcon={false}
    >
      <span className="block truncate hover:underline">{projectId}</span>
    </ResourceIdentityLink>
  )
}

function DeletionAuditDialog({
  account,
  audit,
  onOpenChange,
}: {
  account: WorkspaceAccount
  audit?: WorkspaceDeletionAudit
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(audit)}>
      <DialogContent>
        {audit ? (
          <>
            <DialogHeader>
              <DialogTitle>Approved deletion request</DialogTitle>
            </DialogHeader>
            <ResourceIdentity
              kind={resourceKind(audit.resource_type)}
              mfid={audit.resource_id}
              name={audit.resource_name?.trim() || "Untitled resource"}
              projectId={audit.project_id}
            />
            <dl className="grid grid-cols-2 gap-4 text-body">
              <AuditDetail label="Requested by">
                <AuditIdentity
                  account={account}
                  mfid={audit.requester_id}
                  person={audit.requester}
                />
              </AuditDetail>
              <AuditDetail label="Requested">
                <LocalDateTime value={audit.request_time} />
              </AuditDetail>
              <AuditDetail label="Reviewed by">
                <AuditIdentity
                  account={account}
                  mfid={audit.reviewer_id}
                  person={audit.reviewer}
                />
              </AuditDetail>
              <AuditDetail label="Reviewed">
                <LocalDateTime value={audit.review_time} />
              </AuditDetail>
              <AuditDetail label="Deleted">
                <LocalDateTime value={audit.deleted_at} />
              </AuditDetail>
            </dl>
            <div>
              <h3 className="text-label text-muted-foreground">Reason</h3>
              <p className="mt-1 text-body wrap-break-word">
                {audit.reason?.trim() || "No reason provided."}
              </p>
            </div>
            {audit.reviewer_notes?.trim() ? (
              <div>
                <h3 className="text-label text-muted-foreground">
                  Reviewer comment
                </h3>
                <p className="mt-1 text-body wrap-break-word">
                  {audit.reviewer_notes}
                </p>
              </div>
            ) : null}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} variant="outline">
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function AuditDetail({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0">{children}</dd>
    </div>
  )
}

function resourceKind(type: string | null | undefined) {
  if (type === "sample" || type === "project" || type === "instrument")
    return type
  return "dataset"
}
