import {
  CollectionUpdateStatus,
  PanelState,
  PanelUpdateError,
} from "@/components/crucible/collection-state"
import { useEffect, useRef, useState } from "react"
import type { MouseEventHandler } from "react"
import { useQuery } from "@tanstack/react-query"
import { Disclosure, DisclosureSummary } from "@/components/crucible/disclosure"
import {
  BackPreviewIcon,
  CloseInspectorIcon,
  DisclosureIcon,
} from "@/components/crucible/icons"
import { useInspectorPane } from "@/components/crucible/inspector-pane"
import { MfidValue } from "@/components/crucible/mfid-value"
import { PendingRegion } from "@/components/crucible/pending-region"
import { ResourceRelationships } from "@/components/crucible/resource-relationships"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import { ResourcePreviewLink } from "@/components/crucible/resource-preview-navigation"
import type { ResourcePreviewNavigation } from "@/components/crucible/resource-preview-navigation"
import { ResourceDeletionRequestBadge } from "@/components/crucible/resource-deletion-request-badge"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { ScientificMetadata } from "@/components/crucible/scientific-metadata"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { TruncatedText } from "@/components/ui/truncation-tooltip"
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
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { HubApiClientError } from "@/data/crucible/result"
import type {
  WorkspaceResourceDetail,
  WorkspaceScientificMetadata,
} from "@/data/crucible/workspace-source"
import { useExitSafeValue } from "@/hooks/use-exit-safe"
import { useWindowClass } from "@/hooks/use-window-class"
import {
  projectQueryOptions,
  projectResourceDetail,
} from "@/data/crucible/projects.queries"
import {
  InspectorInstrumentOverview,
  InspectorProjectOverview,
} from "@/features/resource-inspector/inspector-overview"
import { ResourceDeletionRequestCard } from "@/features/resource-deletion/resource-deletion-request"
import { PrintLabelButton } from "@/features/label-printing/print-label-dialog"
import { windowClassAtLeast } from "@/lib/window-class"
import { resourceDisplayName } from "@/lib/resource-name"
import { cn } from "@/lib/utils"

import {
  InspectorDatasetThumbnails,
  InspectorThumbnailsPending,
} from "./inspector-dataset-thumbnails"
import {
  InspectorDatasetFiles,
  InspectorFilesPending,
} from "./inspector-dataset-files"
import { InspectorContext } from "./inspector-context"

export function ResourceInspector({
  navigation,
}: {
  navigation: ResourcePreviewNavigation
}) {
  const title = useRef<HTMLHeadingElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef(true)
  const open = Boolean(navigation.preview) || navigation.invalidPreview
  const exit = useExitSafeValue(navigation.preview)
  const preview = exit.value
  const windowClass = useWindowClass()
  const modal = !windowClassAtLeast(windowClass, "expanded")
  const docked = windowClass === "wide"
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const previewIdentity = navigation.previewIdentity
  // A project preview reads the project with its members, the request the
  // project page also uses, instead of the generic resource read.
  const projectPreview = previewIdentity?.kind === "project"
  const resourceQuery = useQuery({
    ...resourceQueryOptions(scope, preview ?? ""),
    enabled: Boolean(preview) && !projectPreview,
  })
  const projectQuery = useQuery({
    ...projectQueryOptions(scope, preview ?? ""),
    enabled: Boolean(preview) && projectPreview,
    select: (project) => (project ? projectResourceDetail(project) : null),
  })
  const query = projectPreview ? projectQuery : resourceQuery
  const resource = query.data
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
  const pane = useInspectorPane()
  const [hidingPane, setHidingPane] = useState(false)
  if (hidingPane && !preview) setHidingPane(false)
  // With the pane hidden, wide screens float previews like medium screens; a
  // preview shown when the pane is hidden slides out with it instead.
  const paneDocked =
    docked &&
    (pane === null || pane.open || pane.motion === "hiding" || hidingPane)
  const handsOver =
    docked &&
    pane !== null &&
    (pane.open || pane.motion === "hiding") &&
    navigation.host.kind !== "pane"
  const remember = pane?.remember
  const registerHostPreview = pane?.registerHostPreview
  const forget = pane?.forget
  const focusedPreview = useRef(
    navigation.host.kind === "pane" ? navigation.preview : undefined
  )

  useEffect(() => {
    if (!open) {
      focusedPreview.current = undefined
      return
    }
    if (focusedPreview.current === navigation.preview) return
    focusedPreview.current = navigation.preview
    restoreFocus.current = true
    title.current?.focus({ preventScroll: true })
    body.current?.scrollTo({ top: 0 })
  }, [navigation.preview, open])

  const closePreview = useRef(navigation.close)
  useEffect(() => {
    closePreview.current = navigation.close
  })

  useEffect(() => {
    if (!handsOver || !navigation.preview) return
    return registerHostPreview?.(() => {
      restoreFocus.current = false
      setHidingPane(true)
      closePreview.current()
    })
  }, [handsOver, navigation.preview, registerHostPreview])

  const dismissedPreview = useRef<string>(undefined)

  useEffect(() => {
    // The router renders the closed preview once more, without its trail,
    // before the URL loses it; do not remember it again.
    if (navigation.preview !== dismissedPreview.current)
      dismissedPreview.current = undefined
    if (!handsOver || !navigation.preview || dismissedPreview.current) return
    remember?.({
      identity:
        previewKind && previewName
          ? { kind: previewKind, mfid: navigation.preview, name: previewName }
          : undefined,
      mfid: navigation.preview,
      previous: navigation.trail,
    })
  }, [
    handsOver,
    navigation.preview,
    navigation.trail,
    previewKind,
    previewName,
    remember,
  ])

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
      modal={modal}
      onOpenChangeComplete={exit.onOpenChangeComplete}
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen) {
          if (eventDetails.reason === "focus-out") {
            eventDetails.cancel()
            return
          }
          if (eventDetails.reason === "outside-press") {
            // Base UI dismisses non-modal dialogs on a touch drag outside;
            // scrolling the page with a finger keeps it open, like the wheel.
            if (
              eventDetails.event.type === "touchmove" ||
              eventDetails.event.type === "touchend"
            ) {
              eventDetails.cancel()
              return
            }
            restoreFocus.current = false
            if (
              paneDocked ||
              isInteractiveOutsideTarget(eventDetails.event.target)
            ) {
              eventDetails.cancel()
              return
            }
          }
          navigation.close()
          if (handsOver) {
            dismissedPreview.current = navigation.preview
            forget?.()
          }
        }
      }}
    >
      <SheetContent
        className="resource-inspector gap-0 overflow-hidden overscroll-contain shadow-2xl data-docked:shadow-none"
        data-docked={paneDocked || undefined}
        data-pane-motion={
          paneDocked && pane
            ? pane.open
              ? (pane.motion ?? undefined)
              : "hiding"
            : undefined
        }
        data-inspector-kind={previewKind}
        initialFocus={navigation.host.kind === "pane" ? false : title}
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
        showOverlay={modal}
      >
        <div className="flex min-h-8 items-center gap-2 px-4 pt-4">
          {navigation.previous ? (
            <ResourcePreviewLink
              aria-label="Back"
              back
              className={buttonVariants({ size: "sm", variant: "ghost" })}
              mfid={navigation.previous}
            >
              <BackPreviewIcon aria-hidden="true" data-icon="inline-start" />
              Back
            </ResourcePreviewLink>
          ) : navigation.host.kind === "pane" ? null : (
            <SheetClose
              render={
                <Button
                  aria-label="Back"
                  size="sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <BackPreviewIcon aria-hidden="true" data-icon="inline-start" />
              Back
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
              className="flex min-w-0 items-start gap-2.5 text-title-section"
              tabIndex={-1}
            >
              {previewKind ? (
                <span className="entity-icon-well entity-icon-well-md">
                  <ResourceTypeIcon className="size-4" type={previewKind} />
                </span>
              ) : null}
              {navigation.invalidPreview ? (
                <span className="min-w-0 wrap-break-word">
                  Invalid resource preview
                </span>
              ) : previewName ? (
                <TruncatedText
                  className={cn(
                    "wrap-break-word",
                    previewKind === "project" && "line-clamp-2"
                  )}
                  label={previewKind === "project" ? previewName : null}
                >
                  {previewName}
                </TruncatedText>
              ) : (
                <Skeleton aria-hidden="true" className="h-6 w-48" />
              )}
            </SheetTitle>
            {preview ? (
              <div className="flex min-w-0">
                <SheetDescription className="sr-only">
                  MFID {preview}
                </SheetDescription>
                <MfidValue presentation="supporting" value={preview} />
              </div>
            ) : null}
            {deletionRequest ? (
              <div className="flex min-w-0">
                <ResourceDeletionRequestBadge status={deletionRequest.status} />
              </div>
            ) : null}
          </div>
        </SheetHeader>
        <div
          ref={body}
          className="resource-inspector-body min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-4"
        >
          {navigation.invalidPreview ? (
            <p role="alert">The preview identifier is not valid.</p>
          ) : preview ? (
            <InspectorBody
              previewKind={previewKind}
              query={query}
              resource={resource}
            />
          ) : null}
        </div>
        {preview ? (
          <SheetFooter
            className={cn(
              "grid gap-2 border-t bg-card",
              previewKind === "sample" || previewKind === "dataset"
                ? "grid-cols-3"
                : "grid-cols-2"
            )}
          >
            <InspectorActions
              mfid={resource?.unique_id ?? preview}
              mode={mode}
              name={previewName ?? preview}
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
      <PrintLabelButton mfid={mfid} name={name} variant="inspector-footer" />
      {kind === "sample" || kind === "dataset" ? (
        <>
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
            : "This resource doesn't exist or you don't have access to it"
        }
      />
    )
  }
  const hasScientificContext =
    resource.kind === "dataset" || resource.kind === "sample"

  return (
    <PendingRegion
      className="flex min-w-0 flex-col gap-4"
      pending={query.isFetching}
    >
      <CollectionUpdateStatus
        label="resource details"
        updating={query.isFetching && !query.isError}
      />
      {query.isError && (
        <PanelUpdateError
          description="Resource details could not be refreshed. Showing the last available data."
          retry={canRetry(query.error) ? () => void query.refetch() : undefined}
        />
      )}
      <InspectorContext resource={resource} />
      {resource.kind === "dataset" ? (
        <>
          <InspectorDatasetThumbnails datasetMfid={resource.unique_id} />
          <InspectorDatasetFiles datasetMfid={resource.unique_id} />
        </>
      ) : null}
      {resource.kind === "project" ? (
        <InspectorProjectOverview projectMfid={resource.unique_id} />
      ) : null}
      {resource.kind === "instrument" ? (
        <InspectorInstrumentOverview instrumentMfid={resource.unique_id} />
      ) : null}
      {hasScientificContext && (
        <>
          <section
            aria-labelledby="inspector-relationships-heading"
            className="border-t pt-4"
          >
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
    </PendingRegion>
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
      className="flex min-w-0 flex-col gap-4"
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
          {kind === "dataset" ? (
            <>
              <InspectorThumbnailsPending />
              <InspectorFilesPending />
            </>
          ) : null}
          <section className="border-t pt-4">
            <h3 className="mb-3 text-title-section">Relationships</h3>
            <div className="grid gap-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          </section>
          <div className="flex items-center gap-1.5 border-t pt-4">
            <DisclosureIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="text-title-section">Scientific metadata</span>
          </div>
        </>
      ) : null}
    </div>
  )
}

function MetadataDisclosure({
  metadata,
}: {
  metadata: WorkspaceScientificMetadata | null
}) {
  const fieldCount = Object.keys(metadata ?? {}).length
  return (
    <Disclosure className="border-t pt-4">
      <DisclosureSummary className="text-title-section">
        <span>Scientific metadata ({fieldCount})</span>
      </DisclosureSummary>
      <div className="mt-4">
        <ScientificMetadata metadata={metadata} />
      </div>
    </Disclosure>
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
