import { Link } from "@tanstack/react-router"

import { CollectionPagination } from "@/components/crucible/collection-pagination"
import {
  ResourceCreatedCell,
  ResourceOpenCell,
  ResourceOwnerCell,
  ResourceProjectCell,
  ResourceUpdatedCell,
} from "@/components/crucible/resource-collection-cells"
import { ResourceCollectionNameCell } from "@/components/crucible/resource-collection-name-cell"
import { SortableTableHead } from "@/components/crucible/sortable-table-head"
import { buttonVariants } from "@/components/ui/button"
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
import type { WorkspaceDataset } from "@/data/crucible/workspace-source"
import type {
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"

export function InstrumentDatasetCollection({
  cursor,
  direction,
  hasNextPage,
  instrumentMfid,
  isPaginationDisabled,
  isLoadingMore,
  items,
  loadMoreError,
  onLoadMore,
  onSort,
  sort,
  total,
  updating,
}: {
  cursor: string | undefined
  direction: SortDirection
  hasNextPage: boolean
  instrumentMfid: string
  isPaginationDisabled: boolean
  isLoadingMore: boolean
  items: readonly WorkspaceDataset[]
  loadMoreError: boolean
  onLoadMore: () => void
  onSort: (sort: ResourceSort, direction: SortDirection) => void
  sort?: ResourceSort
  total: number | null
  updating: boolean
}) {
  return (
    <>
      <Card aria-busy={updating}>
        <CardContent className="px-0">
          {items.length ? (
            <Table
              className="resource-collection-table table-fixed"
              aria-label="Instrument datasets"
            >
              <colgroup>
                <col className="w-data-name-column-with-action xl:w-data-name-column-wide-with-action" />
                <col className="hidden xl:table-column xl:w-data-type-column-wide-with-action" />
                <col className="w-data-project-column-with-action xl:w-data-project-column-wide-with-action" />
                <col className="w-data-owner-column-with-action xl:w-data-owner-column-wide-with-action" />
                <col className="hidden w-data-date-column-with-action xl:table-column xl:w-data-date-column-wide-with-action" />
                <col className="w-data-date-column-with-action xl:w-data-date-column-wide-with-action" />
                <col className="w-data-action-column" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    active={sort === "name"}
                    direction={direction}
                    field="name"
                    label="Name"
                    onChange={onSort}
                  />
                  <TableHead className="hidden xl:table-cell">
                    Measurement
                  </TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Owner</TableHead>
                  <SortableTableHead
                    active={sort === "created"}
                    className="hidden xl:table-cell"
                    direction={direction}
                    field="created"
                    label="Created"
                    onChange={onSort}
                  />
                  <SortableTableHead
                    active={sort === "updated"}
                    direction={direction}
                    field="updated"
                    label="Updated"
                    onChange={onSort}
                  />
                  <TableHead className="text-center">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((dataset) => (
                  <TableRow key={dataset.unique_id}>
                    <ResourceCollectionNameCell
                      className="resource-collection-name"
                      kind="dataset"
                      mfid={dataset.unique_id}
                      name={dataset.dataset_name ?? "Untitled dataset"}
                      subtype={dataset.measurement ?? "Unspecified measurement"}
                      subtypeVisibility="compact"
                    />
                    <TableCell className="resource-collection-type hidden xl:table-cell">
                      <span
                        className="block truncate"
                        title={dataset.measurement ?? undefined}
                      >
                        {dataset.measurement ?? "Unspecified"}
                      </span>
                    </TableCell>
                    <ResourceProjectCell
                      project={dataset.project}
                      projectId={dataset.project_id}
                      relation={dataset.project_relation}
                    />
                    <ResourceOwnerCell owner={dataset.owner} />
                    <ResourceCreatedCell
                      className="hidden xl:table-cell"
                      value={dataset.creation_time}
                    />
                    <ResourceUpdatedCell value={dataset.modification_time} />
                    <ResourceOpenCell
                      kind="dataset"
                      mfid={dataset.unique_id}
                      name={dataset.dataset_name ?? "Untitled dataset"}
                    />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No datasets found</EmptyTitle>
                <EmptyDescription>
                  No accessible datasets are assigned to this instrument.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      {cursor ? (
        <nav
          className="flex flex-wrap items-center justify-end gap-2"
          aria-label="Instrument dataset pages"
        >
          <Link
            className={buttonVariants({ variant: "outline" })}
            from="/instruments/$instrumentMfid/datasets"
            params={{ instrumentMfid }}
            search={(previous) => ({ ...previous, cursor: undefined })}
            to="/instruments/$instrumentMfid/datasets"
          >
            First datasets
          </Link>
        </nav>
      ) : null}
      <CollectionPagination
        disabled={isPaginationDisabled}
        hasNextPage={hasNextPage}
        isError={loadMoreError}
        isLoading={isLoadingMore}
        label="datasets"
        loaded={items.length}
        onLoadMore={onLoadMore}
        total={total}
      />
    </>
  )
}
