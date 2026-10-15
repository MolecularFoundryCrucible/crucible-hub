import { useEffect, useRef } from "react"
import type { MouseEventHandler, ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  BackPreviewIcon,
  CloseInspectorIcon,
} from "@/components/crucible/icons"
import {
  PanelState,
  PanelUpdateError,
} from "@/components/crucible/collection-state"
import { MfidValue } from "@/components/crucible/mfid-value"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceNameLink } from "@/components/crucible/resource-name-link"
import { ResourceRelationships } from "@/components/crucible/resource-relationships"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import { ResourcePreviewLink } from "@/components/crucible/resource-preview-navigation"
import type { ResourcePreviewNavigation } from "@/components/crucible/resource-preview-navigation"
import { ResourceDeletionRequestBadge } from "@/components/crucible/resource-deletion-request-badge"
import { ResourceStatusBadge } from "@/components/crucible/resource-status-badge"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { ScientificMetadata } from "@/components/crucible/scientific-metadata"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import {
  datasetFilesQueryOptions,
  resourceQueryOptions,
} from "@/data/crucible/resources.queries"
import { HubApiClientError } from "@/data/crucible/result"
import type {
  WorkspaceResourceDetail,
  WorkspaceScientificMetadata,
} from "@/data/crucible/workspace-source"
import { useIsMobile } from "@/hooks/use-mobile"
import { FileDownloadAction } from "@/features/dataset-files/dataset-files-card"
import { ResourceDeletionRequestCard } from "@/features/resource-deletion/resource-deletion-request"
import { ResourceGraphLink } from "@/features/resource-graph/resource-graph-link"
import { formatBytes } from "@/lib/format"
import { resourceDisplayName } from "@/lib/resource-name"
import { cn } from "@/lib/utils"

export function ResourceInspector({
  navigation,
}: {
  navigation: ResourcePreviewNavigation
}) {
  const title = useRef<HTMLHeadingElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef(true)
  const open = Boolean(navigation.preview) || navigation.invalidPreview
  const isMobile = useIsMobile()
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const query = useQuery({
    ...resourceQueryOptions(scope, navigation.preview ?? ""),
    enabled: Boolean(navigation.preview),
  })
  const resource = query.data
  const previewIdentity = navigation.previewIdentity
  const previewKind = resource?.kind ?? previewIdentity?.kind
  const rawPreviewName = resource?.name ?? previewIdentity?.name
  const previewName = previewKind
    ? resourceDisplayName(previewKind, rawPreviewName, {
        identifier:
          resource?.kind === "project"
            ? resource.project_id
            : resource?.kind === "instrument"
              ? resource.instrument_id
              : null,
        mfid: resource?.unique_id ?? previewIdentity?.mfid,
      })
    : rawPreviewName
  const deletionRequest =
    resource?.kind === "dataset" || resource?.kind === "sample"
      ? resource.deletion_request
      : null

  useEffect(() => {
    if (open) {
      restoreFocus.current = true
      title.current?.focus({ preventScroll: true })
      body.current?.scrollTo({ top: 0 })
    }
  }, [navigation.preview, open])

  const suppressFocusRestore: MouseEventHandler<HTMLAnchorElement> = (
    event
  ) => {
    if (
      event.button === 0 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.currentTarget.target !== "_blank"
    )
      restoreFocus.current = false
  }

  return (
    <Sheet
      modal={isMobile}
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen) {
          if (eventDetails.reason === "focus-out") {
            eventDetails.cancel()
            return
          }
          if (eventDetails.reason === "outside-press") {
            restoreFocus.current = false
            if (isInteractiveOutsideTarget(eventDetails.event.target)) {
              eventDetails.cancel()
              return
            }
          }
          navigation.close()
        }
      }}
    >
      <SheetContent
        className="resource-inspector gap-0"
        initialFocus={title}
        finalFocus={() => {
          if (!restoreFocus.current) return false
          const target = navigation.trigger.current?.isConnected
            ? navigation.trigger.current
            : document.querySelector<HTMLElement>("main h1")
          navigation.trigger.current = null
          if (target?.tagName === "H1") target.tabIndex = -1
          return target
        }}
        showCloseButton={false}
        showOverlay={isMobile}
      >
        <div className="flex min-h-8 items-center gap-2 px-4 pt-4">
          {navigation.previous ? (
            <ResourcePreviewLink
              aria-label="Previous preview"
              back
              className={buttonVariants({ size: "sm", variant: "outline" })}
              mfid={navigation.previous}
            >
              <BackPreviewIcon aria-hidden="true" data-icon="inline-start" />
              Previous preview
            </ResourcePreviewLink>
          ) : (
            <SheetClose
              render={<Button size="sm" type="button" variant="outline" />}
            >
              <BackPreviewIcon aria-hidden="true" data-icon="inline-start" />
              Previous preview
            </SheetClose>
          )}
          <SheetClose
            className="ml-auto"
            render={
              <Button aria-label="Close" size="icon-sm" variant="ghost" />
            }
          >
            <CloseInspectorIcon aria-hidden="true" />
          </SheetClose>
        </div>
        <SheetHeader>
          <div className="flex min-w-0 flex-col gap-3">
            <SheetTitle
              ref={title}
              aria-label={
                navigation.invalidPreview
                  ? "Invalid resource preview"
                  : (previewName ?? "Loading resource preview")
              }
              aria-atomic="true"
              aria-live="polite"
              className="flex min-w-0 items-start gap-2 text-title-section"
              tabIndex={-1}
            >
              {previewKind ? (
                <ResourceTypeIcon
                  className="mt-1 shrink-0"
                  type={previewKind}
                />
              ) : null}
              {navigation.invalidPreview ? (
                <span className="min-w-0 wrap-break-word">
                  Invalid resource preview
                </span>
              ) : previewName ? (
                <span
                  className={cn(
                    "min-w-0 wrap-break-word",
                    previewKind === "project" && "line-clamp-2"
                  )}
                  title={previewKind === "project" ? previewName : undefined}
                >
                  {previewName}
                </span>
              ) : (
                <Skeleton aria-hidden="true" className="h-6 w-48" />
              )}
            </SheetTitle>
            {navigation.preview ? (
              <div className="flex min-w-0">
                <SheetDescription className="sr-only">
                  MFID {navigation.preview}
                </SheetDescription>
                <MfidValue
                  presentation="supporting"
                  value={navigation.preview}
                />
              </div>
            ) : (
              <SheetDescription>
                Explore linked resources without leaving this page.
              </SheetDescription>
            )}
            {deletionRequest ? (
              <div className="flex min-w-0">
                <ResourceDeletionRequestBadge status={deletionRequest.status} />
              </div>
            ) : null}
          </div>
        </SheetHeader>
        <div
          ref={body}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4"
        >
          {navigation.invalidPreview ? (
            <p role="alert">The preview identifier is not valid.</p>
          ) : navigation.preview ? (
            <InspectorBody
              previewKind={previewKind}
              query={query}
              resource={resource}
            />
          ) : null}
        </div>
        {navigation.preview ? (
          <SheetFooter
            className={cn(
              "grid gap-2 border-t bg-card",
              previewKind === "sample" || previewKind === "dataset"
                ? "grid-cols-3"
                : "grid-cols-1"
            )}
          >
            <InspectorActions
              mfid={resource?.unique_id ?? navigation.preview}
              mode={mode}
              name={previewName ?? navigation.preview}
              navigation={navigation}
              onClick={suppressFocusRestore}
              resource={resource}
              scope={scope}
            />
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function isInteractiveOutsideTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "a[href], button, input, select, textarea, [contenteditable='true'], [role='button'], [role='link'], [data-resource-preview-trigger]"
      )
    )
  )
}

function InspectorActions({
  mfid,
  mode,
  name,
  navigation,
  onClick,
  resource,
  scope,
}: {
  mfid: string
  mode: ReturnType<typeof useWorkspaceMode>
  name: string
  navigation: ResourcePreviewNavigation
  onClick: MouseEventHandler<HTMLAnchorElement>
  resource: WorkspaceResourceDetail | null | undefined
  scope: ReturnType<typeof useWorkspaceScope>
}) {
  const kind = resource?.kind ?? navigation.previewIdentity?.kind
  const fromProject =
    navigation.host.kind === "project-data"
      ? navigation.host.projectMfid
      : navigation.host.kind === "resource"
        ? navigation.host.fromProject
        : undefined

  return (
    <>
      <ResourceFullPageLink
        className="w-full"
        fromProject={fromProject}
        kind={kind}
        mfid={mfid}
        name={name}
        onClick={onClick}
        presentation="inspector-footer"
      />
      {kind === "sample" || kind === "dataset" ? (
        <>
          <ResourceGraphLink
            kind={kind}
            mfid={mfid}
            onClick={onClick}
            presentation="inspector-footer"
          />
          {resource?.kind === "sample" || resource?.kind === "dataset" ? (
            <ResourceDeletionRequestCard
              mode={mode}
              presentation="compact"
              resource={resource}
              scope={scope}
            />
          ) : (
            <Button disabled type="button" variant="destructive">
              Delete
            </Button>
          )}
        </>
      ) : null}
    </>
  )
}

function InspectorBody({
  previewKind,
  query,
  resource,
}: {
  previewKind: WorkspaceResourceDetail["kind"] | undefined
  query: {
    error: Error | null
    isError: boolean
    isFetching: boolean
    isPending: boolean
    refetch: () => Promise<unknown>
  }
  resource: WorkspaceResourceDetail | null | undefined
}) {
  if (query.isPending) {
    return <InspectorBodyPending kind={previewKind} />
  }
  if (!resource) {
    return (
      <PanelState
        retry={canRetry(query.error) ? () => void query.refetch() : undefined}
        role="alert"
        title={
          query.isError
            ? resourceErrorMessage(query.error)
            : "This resource is not available in the current workspace"
        }
      />
    )
  }
  const hasScientificContext =
    resource.kind === "dataset" || resource.kind === "sample"

  return (
    <div aria-busy={query.isFetching} className="flex min-w-0 flex-col gap-6">
      {query.isFetching && !query.isError && (
        <p className="text-supporting text-muted-foreground" role="status">
          Refreshing resource details…
        </p>
      )}
      {query.isError && (
        <PanelUpdateError
          description="Resource details could not be refreshed. Showing the last available data."
          retry={canRetry(query.error) ? () => void query.refetch() : undefined}
        />
      )}
      <InspectorContext resource={resource} />
      {resource.kind === "dataset" ? (
        <InspectorDatasetFiles datasetMfid={resource.unique_id} />
      ) : null}
      {hasScientificContext && (
        <>
          <section aria-labelledby="inspector-relationships-heading">
            <h3
              className="mb-3 text-title-section"
              id="inspector-relationships-heading"
            >
              Relationships
            </h3>
            <ResourceRelationships
              groupHeadingLevel={4}
              kind={resource.kind}
              links={resource.links}
            />
          </section>
          <MetadataDisclosure metadata={resource.scientific_metadata} />
        </>
      )}
    </div>
  )
}

function InspectorBodyPending({
  kind,
}: {
  kind: WorkspaceResourceDetail["kind"] | undefined
}) {
  const hasScientificContext = kind === "dataset" || kind === "sample"
  return (
    <div
      aria-label="Loading resource details"
      className="flex min-w-0 flex-col gap-6"
      role="status"
    >
      <section>
        <h3 className="mb-3 text-title-section">Context</h3>
        <dl className="grid min-w-0 grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="grid gap-2" key={index}>
              <dt>
                <Skeleton className="h-3 w-20" />
              </dt>
              <dd>
                <Skeleton className="h-5 w-32" />
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {hasScientificContext ? (
        <>
          {kind === "dataset" ? <InspectorFilesPending /> : null}
          <section>
            <h3 className="mb-3 text-title-section">Relationships</h3>
            <div className="grid gap-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          </section>
          <div className="border-t pt-4">
            <span className="text-label">Scientific metadata</span>
          </div>
        </>
      ) : null}
    </div>
  )
}

function InspectorDatasetFiles({ datasetMfid }: { datasetMfid: string }) {
  const scope = useWorkspaceScope()
  const filesResult = useQuery(datasetFilesQueryOptions(scope, datasetMfid))
  const files = filesResult.data
  const identity = JSON.stringify(scope)
  const scenario = fixtureScenarioFromScope(scope)

  return (
    <section aria-labelledby="inspector-files-heading">
      <h3 className="mb-3 text-title-section" id="inspector-files-heading">
        Files
      </h3>
      {filesResult.isPending ? (
        <InspectorFileRowsPending />
      ) : files !== undefined ? (
        <div aria-busy={filesResult.isFetching} className="grid gap-3">
          {filesResult.isError ? (
            <PanelUpdateError
              description="Files could not be refreshed. Showing the last available data."
              retry={() => void filesResult.refetch()}
            />
          ) : null}
          {files.length ? (
            <ul className="grid max-w-full min-w-0 divide-y overflow-hidden">
              {files.map((file) => (
                <li
                  className="flex min-w-0 items-center gap-2 p-2"
                  key={file.mfid}
                >
                  <ResourceIdentity
                    className="min-w-0 flex-1"
                    context={`${file.storage_backend} · ${formatBytes(file.size)}`}
                    kind="file"
                    name={file.filename}
                    presentation="collection"
                  />
                  <FileDownloadAction
                    file={file}
                    identity={identity}
                    scenario={scenario}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-muted-foreground">No files</p>
          )}
        </div>
      ) : (
        <PanelState
          retry={() => void filesResult.refetch()}
          role="alert"
          title="Files could not be loaded"
        />
      )}
    </section>
  )
}

function InspectorFilesPending() {
  return (
    <section>
      <h3 className="mb-3 text-title-section">Files</h3>
      <InspectorFileRowsPending />
    </section>
  )
}

function InspectorFileRowsPending() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 2 }, (_, index) => (
        <div className="flex items-center gap-2" key={index}>
          <Skeleton className="size-4 shrink-0" />
          <div className="grid min-w-0 flex-1 gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="size-8 shrink-0" />
        </div>
      ))}
    </div>
  )
}

function InspectorContext({ resource }: { resource: WorkspaceResourceDetail }) {
  const fields = inspectorContextFields(resource)

  return (
    <section aria-labelledby="inspector-context-heading">
      <h3 className="mb-3 text-title-section" id="inspector-context-heading">
        Context
      </h3>
      <dl className="grid min-w-0 grid-cols-2 gap-3">
        {fields.map((field) => (
          <div className="min-w-0" key={field.label}>
            <dt className="text-label text-muted-foreground">{field.label}</dt>
            <dd className="mt-1 text-body break-words">
              {field.value || "Not recorded"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

type InspectorContextField = {
  label: string
  value: ReactNode
}

function inspectorContextFields(
  resource: WorkspaceResourceDetail
): readonly InspectorContextField[] {
  const owner = resource.owner ? <PersonLink person={resource.owner} /> : null

  switch (resource.kind) {
    case "dataset":
      return [
        { label: "Measurement", value: resource.measurement },
        {
          label: "Project",
          value: resource.project ? (
            <ResourceNameLink
              className="line-clamp-2 text-label hover:underline"
              mfid={resource.project.unique_id}
              kind="project"
              name={resourceDisplayName("project", resource.project.title, {
                identifier: resource.project.project_id,
                mfid: resource.project.unique_id,
              })}
              navigation="preview"
              title={resourceDisplayName("project", resource.project.title, {
                identifier: resource.project.project_id,
                mfid: resource.project.unique_id,
              })}
            />
          ) : (
            resource.project_id
          ),
        },
        {
          label: "Instrument",
          value: resource.instrument ? (
            <ResourceNameLink
              className="line-clamp-2 text-label hover:underline"
              mfid={resource.instrument.unique_id}
              kind="instrument"
              name={resourceDisplayName(
                "instrument",
                resource.instrument.instrument_name,
                {
                  identifier: resource.instrument.instrument_id,
                  mfid: resource.instrument.unique_id,
                }
              )}
              navigation="preview"
              title={resourceDisplayName(
                "instrument",
                resource.instrument.instrument_name,
                {
                  identifier: resource.instrument.instrument_id,
                  mfid: resource.instrument.unique_id,
                }
              )}
            />
          ) : (
            resource.instrument_id
          ),
        },
        { label: "Owner", value: owner },
      ]
    case "sample":
      return [
        { label: "Sample type", value: resource.sample_type },
        {
          label: "Project",
          value: resource.project ? (
            <ResourceNameLink
              className="line-clamp-2 text-label hover:underline"
              mfid={resource.project.unique_id}
              kind="project"
              name={resourceDisplayName("project", resource.project.title, {
                identifier: resource.project.project_id,
                mfid: resource.project.unique_id,
              })}
              navigation="preview"
              title={resourceDisplayName("project", resource.project.title, {
                identifier: resource.project.project_id,
                mfid: resource.project.unique_id,
              })}
            />
          ) : (
            resource.project_id
          ),
        },
        { label: "Owner", value: owner },
      ]
    case "project":
      return [
        { label: "Project ID", value: resource.project_id },
        { label: "Organization", value: resource.organization },
        {
          label: "Status",
          value: resource.status ? (
            <ResourceStatusBadge status={resource.status} />
          ) : (
            "Not recorded"
          ),
        },
        { label: "Lead", value: owner },
      ]
    case "instrument":
      return [
        { label: "Instrument ID", value: resource.instrument_id },
        { label: "Type", value: resource.instrument_type },
        {
          label: "Status",
          value: resource.status ? (
            <ResourceStatusBadge status={resource.status} />
          ) : (
            "Not recorded"
          ),
        },
        { label: "Location", value: resource.location },
        { label: "Manufacturer", value: resource.manufacturer },
        { label: "Model", value: resource.model },
        { label: "Owner", value: owner },
      ]
  }
}

function MetadataDisclosure({
  metadata,
}: {
  metadata: WorkspaceScientificMetadata | null
}) {
  const fieldCount = Object.keys(metadata ?? {}).length
  return (
    <details className="border-t pt-4">
      <summary className="cursor-pointer text-label">
        Scientific metadata ({fieldCount})
      </summary>
      <div className="mt-4">
        <ScientificMetadata metadata={metadata} />
      </div>
    </details>
  )
}

function resourceErrorMessage(error: Error | null) {
  if (!(error instanceof HubApiClientError)) {
    return "Resource details could not be loaded."
  }
  if (error.details.kind === "forbidden") {
    return "You do not have permission to view this resource."
  }
  if (error.details.kind === "not-found") {
    return "This resource was not found."
  }
  if (error.details.kind === "timeout") {
    return "Crucible did not respond in time."
  }
  return "Crucible could not load this resource."
}

function canRetry(error: Error | null) {
  return !(error instanceof HubApiClientError) || error.details.retryable
}
