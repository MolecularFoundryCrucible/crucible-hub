import { useSuspenseQuery } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { Link, Outlet, useMatchRoute } from "@tanstack/react-router"

import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
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
import {
  ResourceSectionNavigation,
  resourceSectionActiveProps,
  resourceSectionLinkClassName,
} from "@/components/crucible/resource-section-navigation"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
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
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"
import { formatDate } from "@/lib/format"
import { ResourceSummaryCard } from "@/features/resource-edit/resource-summary-card"
import { DatasetThumbnailsCard } from "@/features/dataset-thumbnails/dataset-thumbnails-card"
import { DatasetFiles } from "@/features/dataset-files/dataset-files-card"
import { useRememberRecentlyViewed } from "@/features/recently-viewed/recently-viewed"
import { ScientificMetadataEditor } from "@/features/resource-metadata/scientific-metadata-editor"
import { ResourceInspector } from "@/features/resource-inspector/resource-inspector"
import { ResourceRelationshipManager } from "@/features/resource-relationships/resource-relationship-manager"

export async function preloadResourceDetail(
  queryClient: QueryClient,
  scope: IdentityScope,
  resourceMfid: string,
  forceApiResolution = false
) {
  const options = resourceQueryOptions(scope, resourceMfid)
  if (forceApiResolution) {
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: options.queryKey,
      refetchType: "none",
    })
    return queryClient.fetchQuery(options)
  }
  return queryClient.ensureQueryData(options)
}

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
  const navigation = useResourcePreviewNavigation({
    fromProject,
    kind: "resource",
    resourceKind,
    resourceMfid,
    section: graphMatch ? "graph" : undefined,
    preview,
  })
  const scope = useWorkspaceScope()
  const resourceOptions = resourceQueryOptions(scope, resourceMfid)
  const { data: resource, dataUpdatedAt } = useSuspenseQuery(resourceOptions)
  useRememberRecentlyViewed(
    resource && (resource.kind === "sample" || resource.kind === "dataset")
      ? {
          kind: resource.kind,
          name: resource.name,
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
                            kind: undefined,
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
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbLink
                    className="break-words"
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
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="break-words">
                {resource.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <PageHeader
          icon={
            <ResourceTypeIcon
              className="mt-1 size-6 shrink-0"
              type={resource.kind}
            />
          }
          title={resource.name}
        />
        <ResourceNavigation
          actions={
            <EntityRefreshAction
              label={`Refresh ${resource.name}`}
              queryKey={resourceOptions.queryKey}
              refreshedAt={dataUpdatedAt}
            />
          }
          fromProject={fromProject}
          resource={resource}
        />
        <Outlet />
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
    <ContentGrid variant="detail">
      <ContentGridItem className="flex flex-col gap-page-section" span="wide">
        <ResourceSummaryCard mode={mode} resource={resource} scope={scope} />
        {resource.kind === "dataset" ? (
          <DatasetFiles datasetMfid={resource.unique_id} />
        ) : null}
      </ContentGridItem>
      <ContentGridItem className="flex flex-col gap-page-section" span="narrow">
        <IdentityCard resource={resource} />
        {resource.kind === "dataset" ? (
          <DatasetThumbnailsCard
            canEdit={resource.capabilities?.can_edit === true}
            datasetMfid={resource.unique_id}
            mode={mode}
            scope={scope}
          />
        ) : null}
      </ContentGridItem>
      <ContentGridItem span="full">
        <ContentGrid variant="split">
          <ResourceRelationshipManager resource={resource} scope={scope} />
          <ScientificMetadataEditor
            mode={mode}
            resource={resource}
            scope={scope}
          />
        </ContentGrid>
      </ContentGridItem>
    </ContentGrid>
  )
}

function ResourceNavigation({
  actions,
  fromProject,
  resource,
}: {
  actions?: React.ReactNode
  fromProject?: string
  resource: Extract<WorkspaceResourceDetail, { kind: "dataset" | "sample" }>
}) {
  if (resource.kind === "sample") {
    return (
      <ResourceSectionNavigation actions={actions} label="Sample sections">
        <Link
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          params={{ sampleMfid: resource.unique_id }}
          search={{ fromProject, preview: undefined }}
          to="/samples/$sampleMfid"
        >
          Overview
        </Link>
        <Link
          activeOptions={{ includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          params={{ sampleMfid: resource.unique_id }}
          preload={false}
          search={{ fromProject, preview: undefined }}
          to="/samples/$sampleMfid/graph"
        >
          Graph
        </Link>
        <Link
          activeOptions={{ includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          params={{ sampleMfid: resource.unique_id }}
          preload={false}
          search={{ fromProject, preview: undefined }}
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
        className={resourceSectionLinkClassName}
        params={{ datasetMfid: resource.unique_id }}
        search={{ fromProject, preview: undefined }}
        to="/datasets/$datasetMfid"
      >
        Overview
      </Link>
      <Link
        activeOptions={{ includeSearch: false }}
        activeProps={resourceSectionActiveProps}
        className={resourceSectionLinkClassName}
        params={{ datasetMfid: resource.unique_id }}
        preload={false}
        search={{ fromProject, preview: undefined }}
        to="/datasets/$datasetMfid/processing"
      >
        Processing
      </Link>
      <Link
        activeOptions={{ includeSearch: false }}
        activeProps={resourceSectionActiveProps}
        className={resourceSectionLinkClassName}
        params={{ datasetMfid: resource.unique_id }}
        preload={false}
        search={{ fromProject, preview: undefined }}
        to="/datasets/$datasetMfid/graph"
      >
        Graph
      </Link>
      <Link
        activeOptions={{ includeSearch: false }}
        activeProps={resourceSectionActiveProps}
        className={resourceSectionLinkClassName}
        params={{ datasetMfid: resource.unique_id }}
        preload={false}
        search={{ fromProject, preview: undefined }}
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
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-label text-muted-foreground">MFID</dt>
                <dd className="mt-1">
                  <MfidValue value={resource.unique_id} />
                </dd>
              </div>
              <div>
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
                <div>
                  <dt className="text-label text-muted-foreground">
                    Visibility
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 text-body">
                    <IdentityFieldIcon
                      type={
                        resource.public
                          ? "visibility-public"
                          : "visibility-private"
                      }
                    />
                    <Badge variant={resource.public ? "secondary" : "outline"}>
                      {resource.public ? "Public" : "Private"}
                    </Badge>
                  </dd>
                </div>
              )}
            </dl>
          </div>
          <MfidQrCode value={resource.unique_id} />
          <dl className="col-span-2 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-label text-muted-foreground">Created</dt>
              <dd className="mt-1 flex items-start gap-2 text-body">
                <IdentityFieldIcon type="created" />
                {formatDate(resource.creation_time)}
              </dd>
            </div>
            <div>
              <dt className="text-label text-muted-foreground">Updated</dt>
              <dd className="mt-1 flex items-start gap-2 text-body">
                <IdentityFieldIcon type="updated" />
                {formatDate(resource.modification_time)}
              </dd>
            </div>
          </dl>
        </ContentGrid>
      </CardContent>
    </Card>
  )
}
