import {
  PendingName,
  CollectionUpdateStatus,
} from "@/components/crucible/collection-state"
import { InlineError } from "@/components/crucible/form-error"
import { useEffect, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import { PendingRegion } from "@/components/crucible/pending-region"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { deletionRequestsInfiniteQueryOptions } from "@/data/crucible/deletion-requests.queries"
import type { WorkspaceDeletionRequestFilters } from "@/data/crucible/deletion-requests.server"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type {
  WorkspaceAccount,
  WorkspaceDeletionRequest,
  WorkspaceDeletionRequestSort,
} from "@/data/crucible/workspace-source"
import { cn } from "@/lib/utils"

import {
  DeletionRequestColgroup,
  DeletionRequestTableHeader,
  DeletionRequestTable,
} from "./deletion-request-table"
import { BulkReviewController } from "./deletion-bulk-review"
import { DeletionRequestDialog } from "./deletion-request-dialog"

const pendingRows = ["first", "second", "third"] as const

export function DeletionRequestQueue({
  account,
  action,
  bulkReview = false,
  emptyTitle,
  filters,
  onSortChange,
  paginate = false,
  scope,
  title,
}: {
  account: WorkspaceAccount
  action?: React.ReactNode
  bulkReview?: boolean
  emptyTitle: string
  filters: Omit<WorkspaceDeletionRequestFilters, "cursor" | "privilegeMode">
  onSortChange?: (
    sort: WorkspaceDeletionRequestSort,
    direction: "asc" | "desc"
  ) => void
  paginate?: boolean
  scope: IdentityScope
  title?: string
}) {
  const options = deletionRequestsInfiniteQueryOptions(scope, filters)
  const result = useInfiniteQuery(options)
  const [selected, setSelected] = useState<WorkspaceDeletionRequest>()
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<number>>(
    () => new Set()
  )
  const pages = result.data?.pages ?? []
  const items = pages.flatMap((page) => page.items)
  const total = pages.at(0)?.total ?? null

  useEffect(() => {
    setSelectedRequestIds(new Set())
  }, [
    filters.direction,
    filters.projectMfid,
    filters.scope,
    filters.sort,
    filters.status,
    scope[1],
    scope[2],
    scope[3],
  ])

  const updating = result.isFetching && !result.isFetchingNextPage
  return (
    <>
      <CollectionUpdateStatus label="deletion requests" updating={updating} />
      <Card>
        {title || action ? (
          <CardHeader>
            {title ? <CardTitle>{title}</CardTitle> : null}
            {action ? <CardAction>{action}</CardAction> : null}
          </CardHeader>
        ) : null}
        {result.isPending ? (
          <DeletionRequestPending
            bulkReview={bulkReview}
            direction={filters.direction}
            onSortChange={onSortChange}
            showProject={!filters.projectMfid}
            showStatus={filters.status !== "pending"}
            sort={filters.sort}
          />
        ) : result.isError && !result.data ? (
          <CardContent>
            <Empty className="min-h-40 border" role="alert">
              <EmptyHeader>
                <EmptyTitle>Deletion requests could not be loaded</EmptyTitle>
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
          <PendingRegion pending={updating} render={<CardContent />}>
            <Empty className="min-h-32">
              <EmptyHeader>
                <EmptyTitle>{emptyTitle}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </PendingRegion>
        ) : (
          <PendingRegion
            pending={updating}
            render={<CardContent className="px-0" />}
          >
            {result.isRefetchError ? (
              <InlineError className="px-4 pb-3">
                The list could not be refreshed. Showing the last loaded
                requests.
              </InlineError>
            ) : null}
            <BulkReviewController
              items={bulkReview ? items : []}
              onSelectionChange={setSelectedRequestIds}
              scope={scope}
              selectedRequestIds={selectedRequestIds}
            >
              {(bulkReviewActions) => (
                <DeletionRequestTable
                  account={account}
                  bulkReview={bulkReview}
                  bulkReviewActions={bulkReviewActions}
                  direction={filters.direction}
                  items={items}
                  onSortChange={onSortChange}
                  onOpen={setSelected}
                  onSelectionChange={setSelectedRequestIds}
                  selectedRequestIds={selectedRequestIds}
                  showProject={!filters.projectMfid}
                  showStatus={filters.status !== "pending"}
                  sort={filters.sort}
                />
              )}
            </BulkReviewController>
          </PendingRegion>
        )}
      </Card>
      {paginate ? (
        <CollectionPagination
          disabled={result.isFetching}
          hasNextPage={result.hasNextPage}
          isError={result.isFetchNextPageError}
          isLoading={result.isFetchingNextPage}
          label="deletion requests"
          loaded={items.length}
          onLoadMore={() => void result.fetchNextPage()}
          total={total}
        />
      ) : null}
      <DeletionRequestDialog
        account={account}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined)
        }}
        request={selected}
        scope={scope}
      />
    </>
  )
}

function DeletionRequestPending({
  bulkReview,
  direction,
  onSortChange,
  showProject,
  showStatus,
  sort,
}: {
  bulkReview: boolean
  direction: "asc" | "desc"
  onSortChange?: (
    sort: WorkspaceDeletionRequestSort,
    direction: "asc" | "desc"
  ) => void
  showProject: boolean
  showStatus: boolean
  sort: WorkspaceDeletionRequestSort
}) {
  return (
    <CardContent
      aria-label="Loading deletion requests"
      className="px-0"
      role="status"
    >
      <Table
        before={
          bulkReview ? (
            <div className="table-card-only min-h-11 items-center gap-2 border-b px-3 py-2">
              <Checkbox
                aria-label="Select all loaded reviewable requests"
                disabled
              />
              <span className="text-label">Select all loaded</span>
            </div>
          ) : null
        }
        className={cn(
          "deletion-request-table table-fixed",
          bulkReview && "has-selection",
          showProject && "has-project"
        )}
      >
        <DeletionRequestColgroup
          bulkReview={bulkReview}
          showProject={showProject}
          showStatus={showStatus}
        />
        <DeletionRequestTableHeader
          bulkReview={bulkReview}
          direction={direction}
          onSortChange={onSortChange}
          showProject={showProject}
          showStatus={showStatus}
          sort={sort}
        />
        <TableBody>
          {pendingRows.map((row) => (
            <TableRow key={row}>
              {bulkReview ? (
                <TableCell kind="select" className="deletion-request-select">
                  <Skeleton className="mx-auto size-4 rounded-sm" />
                </TableCell>
              ) : null}
              <TableCell className="deletion-request-resource">
                <PendingName />
              </TableCell>
              {showProject ? (
                <TableCell
                  className="deletion-request-project"
                  data-label="Project"
                >
                  <Skeleton className="h-4 w-3/4" />
                </TableCell>
              ) : null}
              <TableCell
                className="deletion-request-requester"
                data-label="Requested by"
              >
                <Skeleton className="h-4 w-3/4" />
              </TableCell>
              <TableCell
                kind="date"
                className="deletion-request-date"
                data-label="Requested"
              >
                <Skeleton className="h-4 w-4/5" />
              </TableCell>
              {showStatus ? (
                <TableCell
                  className="deletion-request-status"
                  data-label="Status"
                >
                  <Skeleton className="h-6 w-16 rounded-full" />
                </TableCell>
              ) : null}
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
