import { useMemo } from "react"
import type { InfiniteData } from "@tanstack/react-query"

import type { ResourceSibling } from "@/components/crucible/resource-sibling-navigation"
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
    error?: unknown
    isError: boolean
  }>
  hasNextPage: boolean
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
  const siblingCollection = useMemo(() => {
    const mapItems = (resources: readonly TItem[]): ResourceSibling[] =>
      resources.map((resource) => ({
        kind,
        mfid: resource.unique_id,
        name: getName(resource),
      }))
    return {
      hasNextPage: query.hasNextPage,
      items: mapItems(items),
      loadMore: async () => {
        const next = await query.fetchNextPage()
        if (next.isError) {
          throw next.error ?? new Error("The next page could not be loaded.")
        }
        const pages = next.data?.pages
        return {
          hasNextPage: Boolean(pages?.at(-1)?.nextCursor),
          items: mapItems(flattenCursorPages(pages)),
          total: cursorPageTotal(pages),
        }
      },
      startsAtBeginning: !initialCursor,
      total,
    }
  }, [
    getName,
    initialCursor,
    items,
    kind,
    query.fetchNextPage,
    query.hasNextPage,
    total,
  ])
  return { items, siblingCollection, total }
}

export function sampleCollectionName(sample: WorkspaceSample) {
  return sample.sample_name
}

export function datasetCollectionName(dataset: WorkspaceDataset) {
  return dataset.dataset_name ?? "Untitled dataset"
}
