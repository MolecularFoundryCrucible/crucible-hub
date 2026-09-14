import { useMemo } from "react"
import type { InfiniteData } from "@tanstack/react-query"

import { resourcePreviewSiblingCollection } from "@/components/crucible/resource-preview-navigation"
import {
  cursorPageTotal,
  flattenCursorPages,
} from "@/data/crucible/cursor-pages"
import type {
  WorkspaceCursorPage,
  WorkspaceDataset,
  WorkspaceSample,
} from "@/data/crucible/workspace-source"

type CursorQueryResult<TItem> = {
  data: InfiniteData<WorkspaceCursorPage<TItem>, unknown> | undefined
  fetchNextPage: () => Promise<{
    data?: InfiniteData<WorkspaceCursorPage<TItem>, unknown>
  }>
  hasNextPage: boolean
  isFetchNextPageError: boolean
  isFetching: boolean
}

export function useCursorResourceCollection<
  TItem extends { unique_id: string },
>({
  getName,
  initialCursor,
  kind,
  query,
}: {
  getName: (item: TItem) => string
  initialCursor: string | undefined
  kind: "dataset" | "sample"
  query: CursorQueryResult<TItem>
}) {
  const items = useMemo(
    () => flattenCursorPages(query.data?.pages),
    [query.data]
  )
  const total = cursorPageTotal(query.data?.pages)
  const siblingCollection = useMemo(
    () =>
      resourcePreviewSiblingCollection({
        getName,
        hasNextPage: query.hasNextPage,
        isFetchingNextPage: query.isFetching,
        items,
        kind,
        loadMore: async () => {
          const next = await query.fetchNextPage()
          return flattenCursorPages(next.data?.pages)
        },
        loadMoreError: query.isFetchNextPageError,
        startsAtBeginning: !initialCursor,
        total,
      }),
    [
      getName,
      initialCursor,
      items,
      kind,
      query.fetchNextPage,
      query.hasNextPage,
      query.isFetchNextPageError,
      query.isFetching,
      total,
    ]
  )
  return { items, siblingCollection, total }
}

export function sampleCollectionName(sample: WorkspaceSample) {
  return sample.sample_name
}

export function datasetCollectionName(dataset: WorkspaceDataset) {
  return dataset.dataset_name ?? "Untitled dataset"
}
