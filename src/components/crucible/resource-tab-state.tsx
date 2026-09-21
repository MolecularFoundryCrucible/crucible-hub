import { useRouter } from "@tanstack/react-router"

import {
  ContentBoundary,
  ContentGrid,
  ContentGridItem,
} from "@/components/crucible/content-layout"
import { PanelState } from "@/components/crucible/collection-state"
import { useRouteErrorReport } from "@/components/crucible/route-error-report"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ErrorComponentProps } from "@tanstack/react-router"

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
        <ContentGridItem
          className="contents xl:flex xl:flex-col xl:gap-page-section"
          span="wide"
        >
          <div className="order-1 min-w-0 xl:order-none">
            <ResourceCardPending title="Summary" />
          </div>
          {dataset ? (
            <div className="order-4 min-w-0 xl:order-none">
              <ResourceCardPending title="Files" />
            </div>
          ) : null}
        </ContentGridItem>
        <ContentGridItem
          className="contents xl:flex xl:flex-col xl:gap-page-section"
          span="narrow"
        >
          <div className="order-2 min-w-0 xl:order-none">
            <ResourceCardPending title="Identity" />
          </div>
          {dataset ? (
            <div className="order-3 min-w-0 xl:order-none">
              <ResourceCardPending title="Thumbnails" />
            </div>
          ) : null}
        </ContentGridItem>
        {instrument ? (
          <ContentGridItem span="full">
            <ResourceCardPending title="Scientific metadata" />
          </ContentGridItem>
        ) : (
          <>
            <ContentGridItem className="order-6 xl:order-none" span="wide">
              <ResourceCardPending title="Scientific metadata" />
            </ContentGridItem>
            <ContentGridItem className="order-5 xl:order-none" span="narrow">
              <ResourceCardPending title="Relationships" />
            </ContentGridItem>
          </>
        )}
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

export function ResourceTabLoadError({ error, info }: ErrorComponentProps) {
  const router = useRouter()
  const report = useRouteErrorReport({
    error,
    info,
    scope: "resource-tab",
  })
  return (
    <ContentBoundary width="reading">
      <PanelState
        description={`${report.message} Reference: ${report.reference}`}
        retry={() => {
          if (report.reloadRequired) {
            window.location.reload()
            return
          }
          void router.invalidate()
        }}
        retryLabel={report.reloadRequired ? "Reload page" : "Try again"}
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
