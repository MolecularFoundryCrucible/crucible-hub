import type { WorkspaceCursorPage } from "./workspace-source"

export function flattenCursorPages<TItem extends { unique_id: string }>(
  pages: readonly WorkspaceCursorPage<TItem>[] | undefined
) {
  const seen = new Set<string>()
  const items: TItem[] = []
  for (const page of pages ?? []) {
    for (const item of page.items) {
      if (seen.has(item.unique_id)) continue
      seen.add(item.unique_id)
      items.push(item)
    }
  }
  return items
}

export function cursorPageTotal<TItem>(
  pages: readonly WorkspaceCursorPage<TItem>[] | undefined
) {
  return pages?.find((page) => page.total !== null)?.total ?? null
}
