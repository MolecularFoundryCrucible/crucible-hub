import { useRouter } from "@tanstack/react-router"

import {
  ContentBoundary,
  ContentGrid,
  ContentGridItem,
} from "@/components/crucible/content-layout"
import { PanelState } from "@/components/crucible/collection-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type ResourceOverviewKind = "dataset" | "instrument" | "sample"

export function ResourceOverviewPending({
  resourceKind,
}: {
  resourceKind: ResourceOverviewKind
}) {
  const instrument = resourceKind === "instrument"
  const dataset = resourceKind === "dataset"

  return (
    <div aria-label="Loading resource overview" role="status">
      <ContentGrid variant="detail">
        <ContentGridItem className="flex flex-col gap-page-section" span="wide">
          <ResourceCardPending title="Summary" />
          {dataset ? <ResourceCardPending title="Files" /> : null}
        </ContentGridItem>
        <ContentGridItem
          className="flex flex-col gap-page-section"
          span="narrow"
        >
          <ResourceCardPending title="Identity" />
          {dataset ? <ResourceCardPending title="Thumbnails" /> : null}
        </ContentGridItem>
        <ContentGridItem span="full">
          {instrument ? (
            <ResourceCardPending title="Scientific metadata" />
          ) : (
            <ContentGrid variant="split">
              <ResourceCardPending title="Relationships" />
              <ResourceCardPending title="Scientific metadata" />
            </ContentGrid>
          )}
        </ContentGridItem>
      </ContentGrid>
    </div>
  )
}

export function ResourceManagementPending() {
  return (
    <div
      aria-label="Loading resource management"
      className="flex min-w-0 flex-col gap-6"
      role="status"
    >
      <ContentBoundary width="reading">
        <ResourceCardPending title="Access management" />
      </ContentBoundary>
      <ContentBoundary width="reading">
        <ResourceCardPending title="Resource management" />
      </ContentBoundary>
    </div>
  )
}

export function ResourceTabLoadError() {
  const router = useRouter()
  return (
    <ContentBoundary width="reading">
      <PanelState
        description="The resource header and navigation remain available."
        retry={() => void router.invalidate()}
        role="alert"
        title="This section could not be loaded"
      />
    </ContentBoundary>
  )
}

function ResourceCardPending({ title }: { title: string }) {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
      </CardContent>
    </Card>
  )
}
