import type { ReactNode } from "react"

import {
  ContentGrid,
  ContentGridItem,
} from "@/components/crucible/content-layout"

/**
 * Project and instrument Overview: Summary and metadata in the main column,
 * Identity and People in the side column. Source order matches the stacked
 * order on narrow screens.
 */
export function EntityOverviewLayout({
  identity,
  metadata,
  people,
  summary,
}: {
  identity: ReactNode
  metadata: ReactNode
  people: ReactNode
  summary: ReactNode
}) {
  return (
    <ContentGrid variant="detailAside">
      <ContentGridItem span="wide">{summary}</ContentGridItem>
      <ContentGridItem
        className="flex flex-col gap-page-section [&>*]:min-w-0"
        span="aside"
      >
        {identity}
        {people}
      </ContentGridItem>
      <ContentGridItem span="wide">{metadata}</ContentGridItem>
    </ContentGrid>
  )
}
