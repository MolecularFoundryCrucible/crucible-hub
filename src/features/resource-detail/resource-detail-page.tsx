import { useLayoutEffect, useRef, useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { Link, Outlet, useMatchRoute } from "@tanstack/react-router"

import {
  BackToProjectIcon,
  DownloadFileIcon,
  DownloadUnavailableIcon,
  PreparingDownloadIcon,
  RetryDownloadIcon,
} from "@/components/crucible/icons"
import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
import {
  ContentGrid,
  ContentGridItem,
} from "@/components/crucible/content-layout"
import { PageHeader } from "@/components/crucible/page-header"
import { EntityRefreshAction } from "@/components/crucible/entity-refresh-action"
import { PageLayout } from "@/components/crucible/page-layout"
import { MfidValue } from "@/components/crucible/mfid-value"
import { PersonLink } from "@/components/crucible/person-link"
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
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  datasetFilesQueryOptions,
  resourceQueryOptions,
} from "@/data/crucible/resources.queries"
import { requestWorkspaceFileDownload } from "@/data/crucible/resources.functions"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { HubApiClientError, unwrapHubResult } from "@/data/crucible/result"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type {
  WorkspaceDatasetFile,
  WorkspaceResourceDetail,
} from "@/data/crucible/workspace-source"
import { formatBytes, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ResourceSummaryCard } from "@/features/resource-edit/resource-summary-card"
import { DatasetThumbnailsCard } from "@/features/dataset-thumbnails/dataset-thumbnails-card"
import { DatasetProcessingActivity } from "@/features/dataset-activity/dataset-processing-activity"
import { useRememberRecentlyViewed } from "@/features/recently-viewed/recently-viewed"
import { ScientificMetadataEditor } from "@/features/resource-metadata/scientific-metadata-editor"
import { ResourceInspector } from "@/features/resource-inspector/resource-inspector"
import { ResourceRelationshipManager } from "@/features/resource-relationships/resource-relationship-manager"

export async function preloadResourceDetail(
  queryClient: QueryClient,
  scope: IdentityScope,
  resourceMfid: string
) {
  return queryClient.ensureQueryData(resourceQueryOptions(scope, resourceMfid))
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
  const resourceProjectMfid =
    resource?.kind === "sample" || resource?.kind === "dataset"
      ? resource.project?.unique_id
      : undefined
  useRememberRecentlyViewed(
    resource && (resource.kind === "sample" || resource.kind === "dataset")
      ? {
          kind: resource.kind,
          name: resource.name,
          uniqueId: resource.unique_id,
        }
      : null
  )
  const originProject = useQuery({
    ...projectQueryOptions(scope, fromProject ?? ""),
    enabled: Boolean(fromProject) && resourceProjectMfid !== fromProject,
  })

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
        {fromProject ? (
          <Link
            className="inline-flex w-fit items-center gap-1.5 text-label text-primary hover:underline"
            params={{ projectMfid: fromProject }}
            search={{
              kind: resource.kind === "dataset" ? "datasets" : undefined,
              preview: undefined,
            }}
            to="/projects/$projectMfid"
          >
            <BackToProjectIcon aria-hidden="true" className="size-4" />
            Back to{" "}
            {resource.project?.unique_id === fromProject
              ? (resource.project.title ?? resource.project.project_id)
              : (originProject.data?.title ?? "project")}{" "}
            data
          </Link>
        ) : null}

        <PageHeader
          actions={
            <EntityRefreshAction
              label={`Refresh ${resource.name}`}
              queryKey={resourceOptions.queryKey}
              refreshedAt={dataUpdatedAt}
            />
          }
          icon={
            <ResourceTypeIcon
              className="mt-1 size-6 shrink-0"
              type={resource.kind}
            />
          }
          title={resource.name}
        />
        <ResourceNavigation fromProject={fromProject} resource={resource} />
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
      <ContentGridItem span="wide">
        <ResourceSummaryCard mode={mode} resource={resource} scope={scope} />
      </ContentGridItem>
      <ContentGridItem span="narrow">
        <IdentityCard resource={resource} />
      </ContentGridItem>
      {resource.kind === "dataset" ? (
        <ContentGridItem span="full">
          <DatasetThumbnailsCard
            canEdit={resource.capabilities?.can_edit === true}
            datasetMfid={resource.unique_id}
            mode={mode}
            scope={scope}
          />
        </ContentGridItem>
      ) : null}
      {resource.kind === "dataset" ? (
        <ContentGridItem span="wide">
          <DatasetFiles datasetMfid={resource.unique_id} />
        </ContentGridItem>
      ) : null}
      {resource.kind === "dataset" ? (
        <ContentGridItem span="narrow">
          <DatasetProcessingActivity
            datasetMfid={resource.unique_id}
            scope={scope}
          />
        </ContentGridItem>
      ) : null}
      <ContentGridItem span="narrow">
        <ResourceRelationshipManager resource={resource} scope={scope} />
      </ContentGridItem>
      <ContentGridItem span="wide">
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
  fromProject,
  resource,
}: {
  fromProject?: string
  resource: Extract<WorkspaceResourceDetail, { kind: "dataset" | "sample" }>
}) {
  if (resource.kind === "sample") {
    return (
      <ResourceSectionNavigation label="Sample sections">
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
    <ResourceSectionNavigation label="Dataset sections">
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
      <CardHeader>
        <CardTitle>Identity</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-label text-muted-foreground">MFID</dt>
            <dd className="mt-1">
              <MfidValue value={resource.unique_id} />
            </dd>
          </div>
          <div>
            <dt className="text-label text-muted-foreground">Owner</dt>
            <dd className="mt-1 flex items-start gap-2 text-body">
              <IdentityFieldIcon type="owner" />
              {owner ? (
                <PersonLink
                  name={`${owner.first_name} ${owner.last_name}`}
                  personId={owner.unique_id}
                  username={owner.username}
                >
                  {owner.first_name.charAt(0)}. {owner.last_name}
                </PersonLink>
              ) : (
                "Unknown owner"
              )}
            </dd>
          </div>
          {"public" in resource && (
            <div>
              <dt className="text-label text-muted-foreground">Visibility</dt>
              <dd className="mt-1 flex items-center gap-2 text-body">
                <IdentityFieldIcon
                  type={
                    resource.public ? "visibility-public" : "visibility-private"
                  }
                />
                <Badge variant={resource.public ? "secondary" : "outline"}>
                  {resource.public ? "Public" : "Private"}
                </Badge>
              </dd>
            </div>
          )}
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
      </CardContent>
    </Card>
  )
}

export function DatasetFiles({ datasetMfid }: { datasetMfid: string }) {
  const scope = useWorkspaceScope()
  const filesResult = useQuery(datasetFilesQueryOptions(scope, datasetMfid))
  const files = filesResult.data
  return (
    <Card aria-busy={filesResult.isFetching}>
      <CardHeader>
        <CardTitle>Files</CardTitle>
      </CardHeader>
      <CardContent className={files?.length ? "px-0" : undefined}>
        {filesResult.isPending ? (
          <div
            aria-label="Loading file metadata"
            className="grid gap-3"
            role="status"
          >
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ) : files !== undefined ? (
          <div className="flex flex-col gap-3">
            {filesResult.isError ? (
              <FileRefreshError retry={() => void filesResult.refetch()} />
            ) : filesResult.isFetching ? (
              <p
                className="px-4 pt-4 text-supporting text-muted-foreground sm:px-6"
                role="status"
              >
                Refreshing file metadata…
              </p>
            ) : null}
            {files.length ? (
              <FilesTable files={files} />
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No associated files</EmptyTitle>
                  <EmptyDescription>
                    No file records are attached to this dataset.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-body text-muted-foreground" role="alert">
              File metadata could not be loaded.
            </p>
            <div>
              <Button
                onClick={() => void filesResult.refetch()}
                variant="outline"
              >
                Try again
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FileRefreshError({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
      <p className="text-body text-muted-foreground" role="alert">
        File metadata could not be refreshed. Showing the last available data.
      </p>
      <Button onClick={retry} size="sm" variant="outline">
        Try again
      </Button>
    </div>
  )
}

export function FilesTable({
  files,
}: {
  files: readonly WorkspaceDatasetFile[]
}) {
  const scope = useWorkspaceScope()
  const identity = JSON.stringify(scope)
  const scenario = fixtureScenarioFromScope(scope)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Filename</TableHead>
          <TableHead className="text-center">Storage</TableHead>
          <TableHead className="text-center">Size</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">File action</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => (
          <TableRow key={file.mfid}>
            <TableCell>
              <span className="block truncate" title={file.filename}>
                {file.filename}
              </span>
            </TableCell>
            <TableCell className="text-center">
              {file.storage_backend}
            </TableCell>
            <TableCell className="text-center tabular-nums">
              {formatBytes(file.size)}
            </TableCell>
            <TableCell className="text-right">
              <FileDownloadAction
                file={file}
                identity={identity}
                scenario={scenario}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

type FileDownloadState =
  | { status: "idle" }
  | { status: "pending" }
  | { reference?: string; status: "error" }
  | { status: "unavailable" }

function FileDownloadAction({
  file,
  identity,
  scenario,
}: {
  file: WorkspaceDatasetFile
  identity: string
  scenario: ReturnType<typeof fixtureScenarioFromScope>
}) {
  const [state, setState] = useState<FileDownloadState>({ status: "idle" })
  const target = `${identity}\0${file.mfid}`
  const committedTarget = useRef(target)
  const request = useRef<{
    controller: AbortController
    target: string
  } | null>(null)
  const supported = file.storage_backend === "gcs"

  useLayoutEffect(() => {
    committedTarget.current = target
    setState({ status: "idle" })
    request.current = null
    return () => {
      const activeRequest = request.current
      if (activeRequest?.target !== target) return
      activeRequest.controller.abort()
      if (request.current === activeRequest) request.current = null
    }
  }, [target])

  async function download() {
    request.current?.controller.abort()
    const controller = new AbortController()
    const activeRequest = { controller, target }
    request.current = activeRequest
    setState({ status: "pending" })
    try {
      const result = unwrapHubResult(
        await requestWorkspaceFileDownload({
          data: { fileMfid: file.mfid, scenario },
          signal: controller.signal,
        })
      )
      if (
        controller.signal.aborted ||
        request.current !== activeRequest ||
        committedTarget.current !== target
      )
        return
      if (result.status === "unavailable") {
        setState({ status: "unavailable" })
        return
      }
      initiateFileDownload(result.url)
      setState({ status: "idle" })
    } catch (error) {
      if (
        controller.signal.aborted ||
        request.current !== activeRequest ||
        committedTarget.current !== target
      )
        return
      setState({
        status: "error",
        ...(error instanceof HubApiClientError
          ? { reference: error.details.correlationId }
          : {}),
      })
    }
  }

  const unavailable = !supported || state.status === "unavailable"
  const pending = state.status === "pending"
  const error = state.status === "error"
  const actionLabel = pending
    ? `Preparing download for ${file.filename}`
    : error
      ? `Retry download for ${file.filename}`
      : unavailable
        ? `Download unavailable for ${file.filename}`
        : `Download ${file.filename}`
  const ActionIcon = pending
    ? PreparingDownloadIcon
    : error
      ? RetryDownloadIcon
      : unavailable
        ? DownloadUnavailableIcon
        : DownloadFileIcon

  return (
    <>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <Button
            aria-busy={pending}
            aria-label={actionLabel}
            disabled={pending || unavailable}
            onClick={pending || unavailable ? undefined : () => void download()}
            size="icon-sm"
            variant="outline"
          >
            <ActionIcon
              aria-hidden="true"
              className={cn(pending && "motion-safe:animate-spin")}
              data-icon="inline-start"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{actionLabel}</TooltipContent>
      </Tooltip>
      {pending || unavailable ? (
        <span className="sr-only" role="status">
          {actionLabel}
        </span>
      ) : null}
      {state.status === "error" ? (
        <span className="sr-only" role="alert">
          Download could not be prepared.
          {state.reference ? ` Reference: ${state.reference}` : ""}
        </span>
      ) : null}
    </>
  )
}

export function initiateFileDownload(url: string) {
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.referrerPolicy = "no-referrer"
  anchor.rel = "noopener noreferrer"
  anchor.target = "_self"
  anchor.click()
}
