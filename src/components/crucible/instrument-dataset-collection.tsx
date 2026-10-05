import { Link } from "@tanstack/react-router"

import { CollectionPageNavigation } from "@/components/crucible/collection-page-navigation"
import { CollectionPagination } from "@/components/crucible/collection-pagination"
import { ResourceCollectionTable } from "@/components/crucible/resource-collection-table"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
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
            <ResourceCollectionTable
              ariaLabel="Instrument datasets"
              direction={direction}
              items={items}
              kind="dataset"
              onSort={onSort}
              showSubtypeColumn
              sort={sort}
              subtypeVisibility="compact"
            />
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

      <CollectionPageNavigation
        label="Instrument dataset pages"
        previous={
          cursor ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ instrumentMfid }}
              search={(previous) => ({ ...previous, cursor: undefined })}
              to="/instruments/$instrumentMfid"
            >
              First datasets
            </Link>
          ) : undefined
        }
      />
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
