import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Outlet, useMatchRoute } from "@tanstack/react-router"

import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import {
  ContentGrid,
  ContentGridItem,
} from "@/components/crucible/content-layout"
import { PageHeader } from "@/components/crucible/page-header"
import { EntityRefreshAction } from "@/components/crucible/entity-refresh-action"
import { PageLayout } from "@/components/crucible/page-layout"
import { MfidValue } from "@/components/crucible/mfid-value"
import { MfidQrCode } from "@/components/crucible/mfid-qr-code"
import { PersonLink } from "@/components/crucible/person-link"
import { personIsServiceAccount } from "@/components/crucible/person-identity"
import {
  ResourcePreviewContext,
  useResourcePreviewNavigation,
} from "@/components/crucible/resource-preview-navigation"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { ResourceDeletionRequestBadge } from "@/components/crucible/resource-deletion-request-badge"
import { VisibilityBadge } from "@/components/crucible/visibility-badge"
import {
  ResourceSectionNavigation,
  ResourceSectionPanel,
  resourceSectionActiveProps,
  resourceSectionLinkClassName,
} from "@/components/crucible/resource-section-navigation"
import {
  ResourceSiblingNavigationControls,
  useActiveResourceSiblingNavigation,
} from "@/components/crucible/resource-sibling-navigation"
import { ResourceSiblingConfigurationAction } from "@/components/crucible/resource-sibling-configuration"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  isResourceOverviewPath,
  preloadResourceShell,
  resourceQueryOptions,
  resourceSummaryQueryOptions,
} from "@/data/crucible/resources.queries"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"
import { ResourceSummaryCard } from "@/features/resource-edit/resource-summary-card"
import { DatasetThumbnailsCard } from "@/features/dataset-thumbnails/dataset-thumbnails-card"
import { DatasetFiles } from "@/features/dataset-files/dataset-files-card"
import { useRememberRecentlyViewed } from "@/features/recently-viewed/recently-viewed"
import { ScientificMetadataEditor } from "@/features/resource-metadata/scientific-metadata-editor"
import { ResourceInspector } from "@/features/resource-inspector/resource-inspector"
import { ManageSectionLink } from "@/features/resource-access/manage-section-link"
import { ResourceRelationshipManager } from "@/features/resource-relationships/resource-relationship-manager"
import { resourceGraphWarmupProps } from "@/features/resource-graph/resource-graph-warmup"
import { resourceDisplayName } from "@/lib/resource-name"

export { isResourceOverviewPath, preloadResourceShell }

export function ResourceWorkspace({
  fromProject,
  resourceKind,
  resourceMfid,
  preview,
}: {
  fromProject?: string
  resourceKind: "dataset" | "sample"
  resourceMfid: string
  preview: unknown
}) {
  const matchRoute = useMatchRoute()
  const graphMatch =
    resourceKind === "sample"
      ? matchRoute({
          params: { sampleMfid: resourceMfid },
          to: "/samples/$sampleMfid/graph",
        })
      : matchRoute({
          params: { datasetMfid: resourceMfid },
          to: "/datasets/$datasetMfid/graph",
        })
  const overviewMatch =
    resourceKind === "sample"
      ? matchRoute({
          fuzzy: false,
          params: { sampleMfid: resourceMfid },
          to: "/samples/$sampleMfid",
        })
      : matchRoute({
          fuzzy: false,
          params: { datasetMfid: resourceMfid },
          to: "/datasets/$datasetMfid",
        })
  const navigation = useResourcePreviewNavigation({
    fromProject,
    kind: "resource",
    resourceKind,
    resourceMfid,
    section: graphMatch ? "graph" : undefined,
    preview,
  })
  const scope = useWorkspaceScope()
  const resourceOptions = resourceSummaryQueryOptions(scope, resourceMfid)
  const { data: resource, dataUpdatedAt } = useSuspenseQuery(resourceOptions)
  const siblingNavigation = useActiveResourceSiblingNavigation(resourceMfid)
  const displayName = resourceDisplayName(resourceKind, resource?.name)
  useRememberRecentlyViewed(
    resource && (resource.kind === "sample" || resource.kind === "dataset")
      ? {
          kind: resource.kind,
          name: displayName,
          projectId:
            resource.project?.project_id ?? resource.project_id ?? null,
          uniqueId: resource.unique_id,
        }
      : null
  )
  if (!resource || resource.kind !== resourceKind) {
    return (
      <Card className="mx-auto mt-16 max-w-state">
        <CardHeader>
          <CardTitle>Resource not found</CardTitle>
          <CardDescription>
            This resource is not available in the current workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <ResourcePreviewContext.Provider value={navigation}>
      <PageLayout>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                render={
                  <Link
                    search={
                      resource.project
                        ? { preview: undefined }
                        : {
                            datasetCursor: undefined,
                            kind:
                              resourceKind === "dataset"
                                ? "datasets"
                                : undefined,
                            sampleCursor: undefined,
                          }
                    }
                    to={resource.project ? "/projects" : "/data"}
                  />
                }
              >
                {resource.project ? "Projects" : "Data"}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {resource.project ? (
              <>
                <BreadcrumbItem className="max-w-breadcrumb-ancestor min-w-0 shrink">
                  <BreadcrumbLink
                    render={
                      <Link
                        params={{ projectMfid: resource.project.unique_id }}
                        search={{ preview: undefined }}
                        to="/projects/$projectMfid"
                      />
                    }
                  >
                    {resource.project.title ?? resource.project.project_id}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            ) : null}
            <BreadcrumbItem className="min-w-0 flex-1 shrink">
              <BreadcrumbPage>{displayName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <PageHeader
          actions={
            resource.deletion_request ? (
              <ResourceDeletionRequestBadge
                status={resource.deletion_request.status}
              />
            ) : undefined
          }
          icon={<ResourceTypeIcon className="size-5" type={resource.kind} />}
          title={displayName}
        />
        <ResourceNavigation
          actions={
            <>
              {overviewMatch ? (
                <ResourceSiblingNavigationControls
                  configurationAction={
                    <ResourceSiblingConfigurationAction
                      navigation={siblingNavigation}
                      resource={resource}
                      scope={scope}
                    />
                  }
                  fromProject={fromProject}
                  navigation={siblingNavigation}
                />
              ) : null}
              <EntityRefreshAction
                exact={false}
                label={`Refresh details for ${displayName}`}
                queryKey={crucibleKeys.resourceDetails(scope, resourceMfid)}
                refreshedAt={dataUpdatedAt}
                relatedQueryKeys={
                  resource.kind === "dataset"
                    ? [
                        crucibleKeys.datasetFiles(scope, resourceMfid),
                        crucibleKeys.datasetThumbnails(scope, resourceMfid),
                        crucibleKeys.datasetIngestionRequests(
                          scope,
                          resourceMfid
                        ),
                      ]
                    : undefined
                }
                subject={
                  resource.kind === "sample"
                    ? "Sample details"
                    : "Dataset details"
                }
              />
            </>
          }
          fromProject={fromProject}
          resource={resource}
          siblingSessionId={siblingNavigation?.id}
        />
        <ResourceSectionPanel>
          <Outlet />
        </ResourceSectionPanel>
      </PageLayout>
      <ResourceInspector navigation={navigation} />
    </ResourcePreviewContext.Provider>
  )
}

export function ResourceOverview({
  resourceKind,
  resourceMfid,
}: {
  resourceKind: "dataset" | "sample"
  resourceMfid: string
}) {
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, resourceMfid)
  )
  if (!resource || resource.kind !== resourceKind) return null

  return (
    <ContentGrid variant="detailAside">
      <ContentGridItem span="wide">
        <ResourceSummaryCard mode={mode} resource={resource} scope={scope} />
      </ContentGridItem>
      <ContentGridItem
        className="flex flex-col gap-page-section [&>*]:min-w-0"
        span="aside"
      >
        <IdentityCard resource={resource} />
        {resource.kind === "dataset" ? (
          <DatasetThumbnailsCard
            canEdit={resource.capabilities?.can_edit === true}
            datasetMfid={resource.unique_id}
            mode={mode}
            scope={scope}
          />
        ) : null}
        <ResourceRelationshipManager resource={resource} scope={scope} />
      </ContentGridItem>
      <ContentGridItem
        className="flex flex-col gap-page-section [&>*]:min-w-0"
        span="wide"
      >
        {resource.kind === "dataset" ? (
          <DatasetFiles
            canEdit={resource.capabilities?.can_edit === true}
            datasetMfid={resource.unique_id}
          />
        ) : null}
        <ScientificMetadataEditor
          mode={mode}
          resource={resource}
          scope={scope}
        />
      </ContentGridItem>
    </ContentGrid>
  )
}

function ResourceNavigation({
  actions,
  fromProject,
  resource,
  siblingSessionId,
}: {
  actions?: React.ReactNode
  fromProject?: string
  resource: Extract<WorkspaceResourceDetail, { kind: "dataset" | "sample" }>
  siblingSessionId?: string
}) {
  const historyState = siblingSessionId
    ? { resourceSiblingSession: siblingSessionId }
    : {}
  if (resource.kind === "sample") {
    return (
      <ResourceSectionNavigation actions={actions} label="Sample sections">
        <Link
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          viewTransition
          className={resourceSectionLinkClassName}
          params={{ sampleMfid: resource.unique_id }}
          search={{ fromProject, preview: undefined }}
          state={historyState}
          to="/samples/$sampleMfid"
        >
          Overview
        </Link>
        <Link
          activeOptions={{ includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          viewTransition
          className={resourceSectionLinkClassName}
          params={{ sampleMfid: resource.unique_id }}
          preload={false}
          search={{ fromProject, preview: undefined }}
          state={historyState}
          {...resourceGraphWarmupProps}
          to="/samples/$sampleMfid/graph"
        >
          Graph
        </Link>
        <Link
          activeOptions={{ includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          viewTransition
          className={resourceSectionLinkClassName}
          params={{ sampleMfid: resource.unique_id }}
          preload={false}
          search={{ fromProject, preview: undefined }}
          state={historyState}
          to="/samples/$sampleMfid/manage"
        >
          Manage
        </Link>
      </ResourceSectionNavigation>
    )
  }
  return (
    <ResourceSectionNavigation actions={actions} label="Dataset sections">
      <Link
        activeOptions={{ exact: true, includeSearch: false }}
        activeProps={resourceSectionActiveProps}
        viewTransition
        className={resourceSectionLinkClassName}
        params={{ datasetMfid: resource.unique_id }}
        search={{ fromProject, preview: undefined }}
        state={historyState}
        to="/datasets/$datasetMfid"
      >
        Overview
      </Link>
      <Link
        activeOptions={{ includeSearch: false }}
        activeProps={resourceSectionActiveProps}
        viewTransition
        className={resourceSectionLinkClassName}
        params={{ datasetMfid: resource.unique_id }}
        preload={false}
        search={{ fromProject, preview: undefined }}
        state={historyState}
        to="/datasets/$datasetMfid/processing"
      >
        Processing
      </Link>
      <Link
        activeOptions={{ includeSearch: false }}
        activeProps={resourceSectionActiveProps}
        viewTransition
        className={resourceSectionLinkClassName}
        params={{ datasetMfid: resource.unique_id }}
        preload={false}
        search={{ fromProject, preview: undefined }}
        state={historyState}
        {...resourceGraphWarmupProps}
        to="/datasets/$datasetMfid/graph"
      >
        Graph
      </Link>
      <Link
        activeOptions={{ includeSearch: false }}
        activeProps={resourceSectionActiveProps}
        viewTransition
        className={resourceSectionLinkClassName}
        params={{ datasetMfid: resource.unique_id }}
        preload={false}
        search={{ fromProject, preview: undefined }}
        state={historyState}
        to="/datasets/$datasetMfid/manage"
      >
        Manage
      </Link>
    </ResourceSectionNavigation>
  )
}

function IdentityCard({ resource }: { resource: WorkspaceResourceDetail }) {
  const owner = resource.owner

  return (
    <Card>
      <CardContent>
        <ContentGrid variant="identity">
          <div className="min-w-0">
            <CardTitle>Identity</CardTitle>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div className="col-span-2 min-w-0">
                <dt className="text-label text-muted-foreground">MFID</dt>
                <dd className="mt-1">
                  <MfidValue value={resource.unique_id} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-label text-muted-foreground">Owner</dt>
                <dd className="mt-1 flex items-start gap-2 text-body">
                  <IdentityFieldIcon
                    accountType={
                      owner && personIsServiceAccount(owner)
                        ? "service-account"
                        : "person"
                    }
                    type="owner"
                  />
                  {owner ? (
                    <PersonLink nameStyle="abbreviated" person={owner} />
                  ) : (
                    "Unknown owner"
                  )}
                </dd>
              </div>
              {"public" in resource && (
                <div className="min-w-0">
                  <dt className="flex items-baseline gap-2 text-label text-muted-foreground">
                    Visibility
                    <ManageSectionLink resource={resource} section="access" />
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 text-body">
                    <VisibilityBadge isPublic={resource.public} />
                  </dd>
                </div>
              )}
            </dl>
          </div>
          <dl className="content-grid-identity-timestamps grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <dt className="text-label text-muted-foreground">Created</dt>
              <dd className="mt-1 flex items-start gap-2 text-body">
                <IdentityFieldIcon type="created" />
                <LocalDateTime value={resource.creation_time} />
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-label text-muted-foreground">Updated</dt>
              <dd className="mt-1 flex items-start gap-2 text-body">
                <IdentityFieldIcon type="updated" />
                <LocalDateTime value={resource.modification_time} />
              </dd>
            </div>
          </dl>
          <div className="content-grid-identity-qr">
            <MfidQrCode value={resource.unique_id} />
          </div>
        </ContentGrid>
      </CardContent>
    </Card>
  )
}
