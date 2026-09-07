import { useEffect, useRef } from "react"
import type { MouseEventHandler, ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { ExploreGraphFocusIcon } from "@/components/crucible/icons"
import { ResourceRelationships } from "@/components/crucible/resource-relationships"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import { ResourcePreviewLink } from "@/components/crucible/resource-preview-navigation"
import type { ResourcePreviewNavigation } from "@/components/crucible/resource-preview-navigation"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { ScientificMetadata } from "@/components/crucible/scientific-metadata"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError } from "@/data/crucible/result"
import type {
  WorkspaceResourceDetail,
  WorkspaceScientificMetadata,
} from "@/data/crucible/workspace-source"
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
  const scope = useWorkspaceScope()
  const query = useQuery({
    ...resourceQueryOptions(scope, navigation.preview ?? ""),
    enabled: Boolean(navigation.preview),
  })
  const resource = query.data

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
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) navigation.close()
      }}
    >
      <SheetContent
        className="resource-inspector"
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
      >
        <SheetHeader className="pr-12">
          <div className="flex min-w-0 flex-col gap-2">
            {resource && (
              <Badge className="self-start" variant="outline">
                <ResourceTypeIcon
                  data-icon="inline-start"
                  type={resource.kind}
                />
                {resourceTypeLabel(resource.kind)}
              </Badge>
            )}
            <SheetTitle
              ref={title}
              aria-atomic="true"
              aria-live="polite"
              className="break-words"
              tabIndex={-1}
            >
              {navigation.invalidPreview
                ? "Invalid resource preview"
                : (resource?.name ?? "Resource preview")}
            </SheetTitle>
            <SheetDescription className="break-all">
              {navigation.preview
                ? `${resource ? `${resourceTypeLabel(resource.kind)}. ` : ""}MFID ${navigation.preview}`
                : "Explore linked resources without leaving this page."}
            </SheetDescription>
          </div>
          {navigation.previous && (
            <ResourcePreviewLink
              back
              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
              mfid={navigation.previous}
            >
              Back in preview
            </ResourcePreviewLink>
          )}
        </SheetHeader>
        <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {navigation.invalidPreview ? (
            <p role="alert">The preview identifier is not valid.</p>
          ) : navigation.preview ? (
            <InspectorBody query={query} resource={resource} />
          ) : null}
        </div>
        {navigation.preview && (
          <SheetFooter>
            {navigation.host.kind === "resource" &&
            navigation.host.section === "graph" ? (
              <ResourceGraphFocusLink
                onClick={suppressFocusRestore}
                resource={resource}
              />
            ) : null}
            <ResourceFullPageLink
              kind={resource?.kind}
              mfid={resource?.unique_id ?? navigation.preview}
              name={resource?.name ?? navigation.preview}
              onClick={suppressFocusRestore}
              presentation="inspector-footer"
            />
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ResourceGraphFocusLink({
  onClick,
  resource,
}: {
  onClick: MouseEventHandler<HTMLAnchorElement>
  resource: WorkspaceResourceDetail | null | undefined
}) {
  const children = (
    <>
      <ExploreGraphFocusIcon aria-hidden="true" data-icon="inline-start" />
      Explore from here
    </>
  )
  if (resource?.kind === "sample") {
    return (
      <Link
        className={buttonVariants({ variant: "outline" })}
        onClick={onClick}
        params={{ sampleMfid: resource.unique_id }}
        preload={false}
        search={{ preview: undefined }}
        state={{}}
        to="/samples/$sampleMfid/graph"
      >
        {children}
      </Link>
    )
  }
  if (resource?.kind === "dataset") {
    return (
      <Link
        className={buttonVariants({ variant: "outline" })}
        onClick={onClick}
        params={{ datasetMfid: resource.unique_id }}
        preload={false}
        search={{ preview: undefined }}
        state={{}}
        to="/datasets/$datasetMfid/graph"
      >
        {children}
      </Link>
    )
  }
  return (
    <Button disabled type="button" variant="outline">
      {children}
    </Button>
  )
}

function InspectorBody({
  query,
  resource,
}: {
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
    return (
      <div
        aria-label="Loading resource details"
        className="grid gap-3"
        role="status"
      >
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
      </div>
    )
  }
  if (!resource) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert">
          {query.isError
            ? resourceErrorMessage(query.error)
            : "This resource is not available in the current workspace."}
        </p>
        {canRetry(query.error) && (
          <Button
            onClick={() => void query.refetch()}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        )}
      </div>
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
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <p className="text-body text-muted-foreground">
            Resource details could not be refreshed. Showing the last available
            data.
          </p>
          {canRetry(query.error) && (
            <Button
              onClick={() => void query.refetch()}
              size="sm"
              variant="outline"
            >
              Try again
            </Button>
          )}
        </div>
      )}
      <InspectorContext resource={resource} />
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

function InspectorContext({ resource }: { resource: WorkspaceResourceDetail }) {
  const fields = inspectorContextFields(resource)

  return (
    <section aria-labelledby="inspector-context-heading">
      <h3 className="mb-3 text-title-section" id="inspector-context-heading">
        Context
      </h3>
      <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div className="min-w-0" key={field.label}>
            <dt className="text-supporting text-muted-foreground">
              {field.label}
            </dt>
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
  const owner = resource.owner
    ? `${resource.owner.first_name} ${resource.owner.last_name}`
    : null

  switch (resource.kind) {
    case "dataset":
      return [
        { label: "Measurement", value: resource.measurement },
        {
          label: "Project",
          value: resource.project ? (
            <ResourcePreviewLink
              aria-label={`Preview project: ${resource.project.title ?? resource.project.project_id}`}
              className="text-label hover:underline"
              mfid={resource.project.unique_id}
              resourceKind="project"
            >
              {resource.project.title ?? resource.project.project_id}
            </ResourcePreviewLink>
          ) : (
            resource.project_id
          ),
        },
        {
          label: "Instrument",
          value: resource.instrument ? (
            <ResourcePreviewLink
              aria-label={`Preview instrument: ${resource.instrument.instrument_name}`}
              className="text-label hover:underline"
              mfid={resource.instrument.unique_id}
              resourceKind="instrument"
            >
              {resource.instrument.instrument_name}
            </ResourcePreviewLink>
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
            <ResourcePreviewLink
              aria-label={`Preview project: ${resource.project.title ?? resource.project.project_id}`}
              className="text-label hover:underline"
              mfid={resource.project.unique_id}
              resourceKind="project"
            >
              {resource.project.title ?? resource.project.project_id}
            </ResourcePreviewLink>
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
        { label: "Status", value: resource.status },
        { label: "Lead", value: owner },
      ]
    case "instrument":
      return [
        { label: "Instrument ID", value: resource.instrument_id },
        { label: "Type", value: resource.instrument_type },
        { label: "Status", value: resource.status },
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

function resourceTypeLabel(kind: string) {
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
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
