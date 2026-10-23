import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { MouseEventHandler, ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  BackPreviewIcon,
  CloseInspectorIcon,
  MetadataDisclosureIcon,
  NextSiblingIcon,
  PreviousSiblingIcon,
} from "@/components/crucible/icons"
import {
  CollectionUpdateStatus,
  PanelState,
  PanelUpdateError,
} from "@/components/crucible/collection-state"
import { DatasetThumbnailImage } from "@/components/crucible/dataset-thumbnail"
import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
import { useInspectorPane } from "@/components/crucible/inspector-pane"
import {
  COLLAPSED_LIST_LIMIT,
  ListExpansionToggle,
  revealedRowClassName,
} from "@/components/crucible/list-expansion-toggle"
import { LocalDateTime } from "@/components/crucible/local-date-time"
import { MfidValue } from "@/components/crucible/mfid-value"
import { personIsServiceAccount } from "@/components/crucible/person-identity"
import { PersonLink } from "@/components/crucible/person-link"
import { PendingRegion } from "@/components/crucible/pending-region"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import {
  ResourceList,
  ResourceListItem,
  ResourceListItemContent,
} from "@/components/crucible/resource-list"
import { ResourceRelationships } from "@/components/crucible/resource-relationships"
import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import { ResourcePreviewLink } from "@/components/crucible/resource-preview-navigation"
import type { ResourcePreviewNavigation } from "@/components/crucible/resource-preview-navigation"
import { ResourceDeletionRequestBadge } from "@/components/crucible/resource-deletion-request-badge"
import { ResourceStatusBadge } from "@/components/crucible/resource-status-badge"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { ScientificMetadata } from "@/components/crucible/scientific-metadata"
import { SummaryFieldIcon } from "@/components/crucible/summary-field-icon"
import { VisibilityBadge } from "@/components/crucible/visibility-badge"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
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
  datasetThumbnailsQueryOptions,
  resourceQueryOptions,
} from "@/data/crucible/resources.queries"
import { HubApiClientError } from "@/data/crucible/result"
import type {
  WorkspaceResourceDetail,
  WorkspaceScientificMetadata,
} from "@/data/crucible/workspace-source"
import { useIsMobile } from "@/hooks/use-mobile"
import { useExitSafeValue } from "@/hooks/use-exit-safe"
import { useMediaQuery } from "@/hooks/use-media-query"
import { FileDownloadAction } from "@/features/dataset-files/dataset-files-card"
import { ResourceDeletionRequestCard } from "@/features/resource-deletion/resource-deletion-request"
import { ResourceGraphLink } from "@/features/resource-graph/resource-graph-link"
import { formatBytes } from "@/lib/format"
import { resourceDisplayName } from "@/lib/resource-name"
import { cn } from "@/lib/utils"

const INSPECTOR_THUMBNAIL_PAGE_SIZE = 2
const fileNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

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
  const isMobile = useIsMobile()
  const docked = useMediaQuery("(min-width: 90rem)")
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const query = useQuery({
    ...resourceQueryOptions(scope, preview ?? ""),
    enabled: Boolean(preview),
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
      modal={isMobile}
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
        showOverlay={isMobile}
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
            {preview ? (
              <div className="flex min-w-0">
                <SheetDescription className="sr-only">
                  MFID {preview}
                </SheetDescription>
                <MfidValue presentation="supporting" value={preview} />
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
                : "grid-cols-1"
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
            <MetadataDisclosureIcon
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

export function InspectorDatasetThumbnails({
  datasetMfid,
}: {
  datasetMfid: string
}) {
  const scope = useWorkspaceScope()
  const [hydrated, setHydrated] = useState(false)
  const [pageStart, setPageStart] = useState(0)
  const thumbnailsResult = useQuery({
    ...datasetThumbnailsQueryOptions(scope, datasetMfid),
    enabled: hydrated,
  })
  const thumbnails = thumbnailsResult.data

  useEffect(() => setHydrated(true), [])
  useEffect(() => setPageStart(0), [datasetMfid])

  const total = thumbnails?.length ?? 0
  const hasMultiplePages = total > INSPECTOR_THUMBNAIL_PAGE_SIZE
  const maxPageStart =
    total > 0
      ? Math.floor((total - 1) / INSPECTOR_THUMBNAIL_PAGE_SIZE) *
        INSPECTOR_THUMBNAIL_PAGE_SIZE
      : 0
  const activeStart = Math.min(pageStart, maxPageStart)
  const visibleThumbnails =
    thumbnails?.slice(
      activeStart,
      activeStart + INSPECTOR_THUMBNAIL_PAGE_SIZE
    ) ?? []
  const rangeStart = activeStart + 1
  const rangeEnd = activeStart + visibleThumbnails.length
  const rangeLabel =
    rangeStart === rangeEnd
      ? `${rangeStart} of ${total}`
      : `${rangeStart}-${rangeEnd} of ${total}`
  const canShowPrevious = activeStart > 0
  const canShowNext = activeStart + INSPECTOR_THUMBNAIL_PAGE_SIZE < total

  return (
    <section
      aria-labelledby="inspector-thumbnails-heading"
      className="border-t pt-4"
    >
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
        <h3 className="text-title-section" id="inspector-thumbnails-heading">
          Thumbnails
        </h3>
        {hasMultiplePages ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-supporting text-muted-foreground tabular-nums">
              {rangeLabel}
            </span>
            <ButtonGroup aria-label="Thumbnail navigation">
              <Button
                aria-label="Previous thumbnails"
                disabled={!canShowPrevious}
                onClick={() =>
                  setPageStart(
                    Math.max(0, activeStart - INSPECTOR_THUMBNAIL_PAGE_SIZE)
                  )
                }
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <PreviousSiblingIcon aria-hidden="true" />
              </Button>
              <Button
                aria-label="Next thumbnails"
                disabled={!canShowNext}
                onClick={() =>
                  setPageStart(
                    Math.min(
                      maxPageStart,
                      activeStart + INSPECTOR_THUMBNAIL_PAGE_SIZE
                    )
                  )
                }
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <NextSiblingIcon aria-hidden="true" />
              </Button>
            </ButtonGroup>
          </div>
        ) : null}
      </div>
      {!hydrated || thumbnailsResult.isPending ? (
        <InspectorThumbnailRowsPending />
      ) : thumbnails !== undefined ? (
        <div aria-busy={thumbnailsResult.isFetching} className="grid gap-3">
          {thumbnailsResult.isError ? (
            <PanelUpdateError
              description="Thumbnails could not be refreshed. Showing the last available data."
              retry={() => void thumbnailsResult.refetch()}
            />
          ) : null}
          {thumbnails.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {visibleThumbnails.map((thumbnail) => (
                <li className="min-w-0" key={thumbnail.id}>
                  <div className="overflow-hidden rounded-lg border bg-muted/20">
                    <DatasetThumbnailImage
                      alt={thumbnail.thumbnail_name}
                      className="aspect-video w-full bg-card object-contain"
                      loading="lazy"
                      thumbnail={thumbnail}
                      title={thumbnail.thumbnail_name}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-muted-foreground">No thumbnails</p>
          )}
        </div>
      ) : (
        <PanelState
          retry={() => void thumbnailsResult.refetch()}
          role="alert"
          title="Thumbnails could not be loaded"
        />
      )}
    </section>
  )
}

function InspectorThumbnailsPending() {
  return (
    <section className="border-t pt-4">
      <h3 className="mb-3 text-title-section">Thumbnails</h3>
      <InspectorThumbnailRowsPending />
    </section>
  )
}

function InspectorThumbnailRowsPending() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: INSPECTOR_THUMBNAIL_PAGE_SIZE }, (_, index) => (
        <Skeleton className="aspect-video w-full rounded-lg" key={index} />
      ))}
    </div>
  )
}

export function InspectorDatasetFiles({
  datasetMfid,
}: {
  datasetMfid: string
}) {
  const scope = useWorkspaceScope()
  const listId = useId()
  const [expanded, setExpanded] = useState(false)
  const filesResult = useQuery(datasetFilesQueryOptions(scope, datasetMfid))
  const files = filesResult.data
  const identity = JSON.stringify(scope)
  const scenario = fixtureScenarioFromScope(scope)

  useEffect(() => setExpanded(false), [datasetMfid])

  const sortedFiles = useMemo(
    () =>
      files
        ? [...files].sort((left, right) =>
            fileNameCollator.compare(left.filename, right.filename)
          )
        : undefined,
    [files]
  )
  const visibleFiles = expanded
    ? sortedFiles
    : sortedFiles?.slice(0, COLLAPSED_LIST_LIMIT)

  return (
    <section
      aria-labelledby="inspector-files-heading"
      className="border-t pt-4"
    >
      <h3 className="mb-3 text-title-section" id="inspector-files-heading">
        Files{files?.length ? ` (${files.length})` : ""}
      </h3>
      {filesResult.isPending ? (
        <InspectorFileRowsPending />
      ) : sortedFiles !== undefined && visibleFiles !== undefined ? (
        <div aria-busy={filesResult.isFetching} className="grid gap-3">
          {filesResult.isError ? (
            <PanelUpdateError
              description="Files could not be refreshed. Showing the last available data."
              retry={() => void filesResult.refetch()}
            />
          ) : null}
          {sortedFiles.length ? (
            <div>
              <ResourceList id={listId}>
                {visibleFiles.map((file, index) => (
                  <ResourceListItem
                    className={revealedRowClassName(index)}
                    key={file.mfid}
                  >
                    <ResourceListItemContent className="px-0">
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
                    </ResourceListItemContent>
                  </ResourceListItem>
                ))}
              </ResourceList>
              {sortedFiles.length > COLLAPSED_LIST_LIMIT ? (
                <div className="mt-1 -ml-1.5 flex">
                  <ListExpansionToggle
                    controls={listId}
                    expanded={expanded}
                    noun="files"
                    onExpandedChange={setExpanded}
                    total={sortedFiles.length}
                  />
                </div>
              ) : null}
            </div>
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
    <section className="border-t pt-4">
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
          <div
            className={
              field.fullWidth
                ? "col-span-2 min-w-0"
                : field.colStart1
                  ? "col-start-1 min-w-0"
                  : "min-w-0"
            }
            key={field.label}
          >
            <dt className="text-label text-muted-foreground">{field.label}</dt>
            <dd className="mt-1 flex min-w-0 items-start gap-2 text-body break-words">
              {field.icon}
              <span className="min-w-0">{field.value || "-"}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

type InspectorContextField = {
  colStart1?: boolean
  fullWidth?: boolean
  icon?: ReactNode
  label: string
  value: ReactNode
}

function inspectorContextFields(
  resource: WorkspaceResourceDetail
): readonly InspectorContextField[] {
  const ownerIcon = (
    <IdentityFieldIcon
      accountType={
        resource.owner && personIsServiceAccount(resource.owner)
          ? "service-account"
          : "person"
      }
      type="owner"
    />
  )
  const owner = resource.owner ? (
    <PersonLink nameStyle="abbreviated" person={resource.owner} />
  ) : null
  const createdField: InspectorContextField = {
    colStart1: true,
    icon: <IdentityFieldIcon type="created" />,
    label: "Created",
    value: <LocalDateTime fallback="-" value={resource.creation_time} />,
  }
  const updatedField: InspectorContextField = {
    icon: <IdentityFieldIcon type="updated" />,
    label: "Updated",
    value: <LocalDateTime fallback="-" value={resource.modification_time} />,
  }

  switch (resource.kind) {
    case "dataset": {
      const projectName = resource.project
        ? resourceDisplayName("project", resource.project.title, {
            identifier: resource.project.project_id,
            mfid: resource.project.unique_id,
          })
        : null
      const instrumentName = resource.instrument
        ? resourceDisplayName(
            "instrument",
            resource.instrument.instrument_name,
            {
              identifier: resource.instrument.instrument_id,
              mfid: resource.instrument.unique_id,
            }
          )
        : null
      return [
        {
          icon: <SummaryFieldIcon type="measurement" />,
          label: "Measurement",
          value: resource.measurement,
        },
        {
          icon: <SummaryFieldIcon type="project" />,
          label: "Project",
          value: resource.project ? (
            <ResourceIdentityLink
              context={resource.project.project_id}
              kind="project"
              mfid={resource.project.unique_id}
              name={projectName ?? ""}
              navigation="preview"
            >
              <span
                className="line-clamp-2 text-label group-hover/resource:underline"
                title={projectName ?? undefined}
              >
                {projectName}
              </span>
            </ResourceIdentityLink>
          ) : (
            resource.project_id
          ),
        },
        {
          icon: <SummaryFieldIcon type="instrument" />,
          label: "Instrument",
          value: resource.instrument ? (
            <ResourceIdentityLink
              context={resource.instrument.instrument_id}
              kind="instrument"
              mfid={resource.instrument.unique_id}
              name={instrumentName ?? ""}
              navigation="preview"
            >
              <span
                className="line-clamp-2 text-label group-hover/resource:underline"
                title={instrumentName ?? undefined}
              >
                {instrumentName}
              </span>
            </ResourceIdentityLink>
          ) : (
            resource.instrument_id
          ),
        },
        {
          icon: <SummaryFieldIcon type="timestamp" />,
          label: "Timestamp",
          value: <LocalDateTime fallback="-" value={resource.timestamp} />,
        },
        { icon: ownerIcon, label: "Owner", value: owner },
        {
          label: "Visibility",
          value: <VisibilityBadge isPublic={resource.public} />,
        },
        createdField,
        updatedField,
      ]
    }
    case "sample": {
      const projectName = resource.project
        ? resourceDisplayName("project", resource.project.title, {
            identifier: resource.project.project_id,
            mfid: resource.project.unique_id,
          })
        : null
      return [
        {
          fullWidth: true,
          icon: <SummaryFieldIcon type="description" />,
          label: "Description",
          value: resource.description,
        },
        {
          icon: <SummaryFieldIcon type="type" />,
          label: "Sample type",
          value: resource.sample_type,
        },
        {
          icon: <SummaryFieldIcon type="project" />,
          label: "Project",
          value: resource.project ? (
            <ResourceIdentityLink
              context={resource.project.project_id}
              kind="project"
              mfid={resource.project.unique_id}
              name={projectName ?? ""}
              navigation="preview"
            >
              <span
                className="line-clamp-2 text-label group-hover/resource:underline"
                title={projectName ?? undefined}
              >
                {projectName}
              </span>
            </ResourceIdentityLink>
          ) : (
            resource.project_id
          ),
        },
        {
          icon: <SummaryFieldIcon type="timestamp" />,
          label: "Timestamp",
          value: <LocalDateTime fallback="-" value={resource.timestamp} />,
        },
        { icon: ownerIcon, label: "Owner", value: owner },
        {
          label: "Visibility",
          value: <VisibilityBadge isPublic={resource.public} />,
        },
        createdField,
        updatedField,
      ]
    }
    case "project":
      return [
        {
          icon: <SummaryFieldIcon type="project" />,
          label: "Project ID",
          value: resource.project_id,
        },
        {
          icon: <SummaryFieldIcon type="organization" />,
          label: "Organization",
          value: resource.organization,
        },
        {
          icon: <SummaryFieldIcon type="status" />,
          label: "Status",
          value: resource.status ? (
            <ResourceStatusBadge status={resource.status} />
          ) : null,
        },
        { icon: ownerIcon, label: "Lead", value: owner },
        createdField,
        updatedField,
      ]
    case "instrument":
      return [
        {
          icon: <SummaryFieldIcon type="instrument" />,
          label: "Instrument ID",
          value: resource.instrument_id,
        },
        {
          icon: <SummaryFieldIcon type="type" />,
          label: "Type",
          value: resource.instrument_type,
        },
        {
          icon: <SummaryFieldIcon type="status" />,
          label: "Status",
          value: resource.status ? (
            <ResourceStatusBadge status={resource.status} />
          ) : null,
        },
        {
          icon: <SummaryFieldIcon type="location" />,
          label: "Location",
          value: resource.location,
        },
        {
          icon: <SummaryFieldIcon type="manufacturer" />,
          label: "Manufacturer",
          value: resource.manufacturer,
        },
        {
          icon: <SummaryFieldIcon type="model" />,
          label: "Model",
          value: resource.model,
        },
        { icon: ownerIcon, label: "Owner", value: owner },
        createdField,
        updatedField,
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
    <details className="metadata-disclosure border-t pt-4">
      <summary className="metadata-disclosure-summary flex cursor-pointer list-none items-center gap-1.5 text-title-section [&::-webkit-details-marker]:hidden">
        <MetadataDisclosureIcon
          aria-hidden="true"
          className="metadata-disclosure-icon size-4 shrink-0 text-muted-foreground transition-transform"
        />
        <span>Scientific metadata ({fieldCount})</span>
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
