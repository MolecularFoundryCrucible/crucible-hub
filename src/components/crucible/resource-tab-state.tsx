import { Link, useRouter, useRouterState } from "@tanstack/react-router"

import {
  ContentBoundary,
  ContentGrid,
  ContentGridItem,
} from "@/components/crucible/content-layout"
import {
  CollectionTablePending,
  PanelState,
} from "@/components/crucible/collection-state"
import { PageHeaderSkeleton } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import {
  ResourceSectionNavigation,
  resourceSectionActiveProps,
  resourceSectionLinkClassName,
} from "@/components/crucible/resource-section-navigation"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { useRouteErrorReport } from "@/components/crucible/route-error-report"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { ErrorComponentProps } from "@tanstack/react-router"

type ResourceOverviewKind = "dataset" | "instrument" | "sample"
type EntityWorkspacePendingKind =
  "dataset" | "instrument" | "project" | "sample"

export function EntityWorkspacePending({
  kind,
}: {
  kind: EntityWorkspacePendingKind
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const section = pendingSection(kind, pathname)
  const root =
    kind === "project"
      ? { label: "Projects", to: "/projects" as const }
      : kind === "instrument"
        ? { label: "Instruments", to: "/instruments" as const }
        : { label: "Data", to: "/data" as const }
  const sections = pendingSections(kind, section)

  return (
    <PageLayout>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to={root.to} />}>
              {root.label}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0 flex-1 shrink">
            <BreadcrumbPage>
              <Skeleton className="h-5 w-48 max-w-full" />
              <span className="sr-only">Loading resource name</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeaderSkeleton
        icon={<ResourceTypeIcon className="size-5" type={kind} />}
        identifier={kind === "project" || kind === "instrument"}
        label="Loading resource identity"
      />
      <ResourceSectionNavigation label={`${kind} sections`}>
        {sections.map((item) => (
          <span
            aria-current={item.active ? "page" : undefined}
            className={cn(
              resourceSectionLinkClassName,
              "pointer-events-none",
              item.active && resourceSectionActiveProps.className
            )}
            key={item.label}
          >
            {item.label}
          </span>
        ))}
      </ResourceSectionNavigation>
      {pendingSectionContent(kind, section)}
    </PageLayout>
  )
}

function pendingSection(kind: EntityWorkspacePendingKind, pathname: string) {
  if (pathname.endsWith("/graph")) return "graph"
  if (pathname.endsWith("/processing")) return "processing"
  if (pathname.includes("/settings") || pathname.endsWith("/manage")) {
    return "manage"
  }
  if (pathname.endsWith("/overview")) return "overview"
  if (kind === "project" || kind === "instrument") return "data"
  return "overview"
}

export function pendingSections(
  kind: EntityWorkspacePendingKind,
  active: string
) {
  const labels =
    kind === "dataset"
      ? ["Overview", "Processing", "Graph", "Manage"]
      : kind === "sample"
        ? ["Overview", "Graph", "Manage"]
        : ["Data", "Overview"]
  if (active === "manage" && !labels.includes("Manage")) labels.push("Manage")
  return labels.map((label) => ({
    active: label.toLowerCase() === active,
    label,
  }))
}

function pendingSectionContent(
  kind: EntityWorkspacePendingKind,
  section: string
) {
  if (section === "manage") return <ResourceManagementPending />
  if (section === "graph") return <ResourceGraphPending />
  if (section === "processing") return <ResourceProcessingPending />
  if (section === "data") {
    return (
      <CollectionTablePending
        label={`${kind} data`}
        presentation={kind === "project" ? "resources-scoped" : "resources"}
        subtypeLabel={kind === "instrument" ? "Measurement" : "Sample type"}
      />
    )
  }
  if (kind === "project") return <ProjectOverviewPending />
  return <ResourceOverviewPending resourceKind={kind} />
}

export function ProjectOverviewPending() {
  return (
    <div aria-label="Loading project overview" role="status">
      <ContentGrid variant="detail">
        <ContentGridItem span="wide">
          <ResourceCardPending title="Summary" />
        </ContentGridItem>
        <ContentGridItem span="narrow">
          <ResourceCardPending title="Identity" />
        </ContentGridItem>
        <ContentGridItem span="wide">
          <ResourceCardPending title="People" />
        </ContentGridItem>
        <ContentGridItem span="narrow">
          <ResourceCardPending title="Scientific metadata" />
        </ContentGridItem>
      </ContentGrid>
    </div>
  )
}

export function ResourceGraphPending() {
  return (
    <div
      aria-label="Loading resource graph"
      className="flex min-w-0 flex-col gap-4"
      role="status"
    >
      <Skeleton className="min-h-graph-canvas w-full" />
    </div>
  )
}

function ResourceProcessingPending() {
  return (
    <div
      aria-label="Loading dataset processing"
      className="grid gap-6"
      role="status"
    >
      <ResourceCardPending title="Files and ingestion" />
      <ResourceCardPending title="Dataset processes" />
    </div>
  )
}

export function ResourceOverviewPending({
  resourceKind,
}: {
  resourceKind: ResourceOverviewKind
}) {
  const instrument = resourceKind === "instrument"
  const dataset = resourceKind === "dataset"

  return (
    <div aria-label="Loading resource overview" role="status">
      {instrument ? (
        <ContentGrid variant="detail">
          <ContentGridItem span="wide">
            <ResourceCardPending title="Summary" />
          </ContentGridItem>
          <ContentGridItem span="narrow">
            <ResourceCardPending title="Identity" />
          </ContentGridItem>
          <ContentGridItem span="full">
            <ResourceCardPending title="Scientific metadata" />
          </ContentGridItem>
        </ContentGrid>
      ) : (
        <ContentGrid variant="detailAside">
          <ContentGridItem span="wide">
            <ResourceCardPending title="Summary" />
          </ContentGridItem>
          <ContentGridItem
            className="flex flex-col gap-page-section [&>*]:min-w-0"
            span="aside"
          >
            <ResourceCardPending title="Identity" />
            {dataset ? <ResourceCardPending title="Thumbnails" /> : null}
            <ResourceCardPending title="Relationships" />
          </ContentGridItem>
          <ContentGridItem
            className="flex flex-col gap-page-section [&>*]:min-w-0"
            span="wide"
          >
            {dataset ? <ResourceCardPending title="Files" /> : null}
            <ResourceCardPending title="Scientific metadata" />
          </ContentGridItem>
        </ContentGrid>
      )}
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

export function ResourceCardPending({ title }: { title: string }) {
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
