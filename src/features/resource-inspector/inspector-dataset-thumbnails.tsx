import {
  PanelState,
  PanelUpdateError,
} from "@/components/crucible/collection-state"
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  NextSiblingIcon,
  PreviousSiblingIcon,
} from "@/components/crucible/icons"
import { DatasetThumbnailImage } from "@/components/crucible/dataset-thumbnail"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Skeleton } from "@/components/ui/skeleton"
import { datasetThumbnailsQueryOptions } from "@/data/crucible/resources.queries"

const INSPECTOR_THUMBNAIL_PAGE_SIZE = 2

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
            <ul className="grid gap-3 @fields:grid-cols-2">
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

export function InspectorThumbnailsPending() {
  return (
    <section className="border-t pt-4">
      <h3 className="mb-3 text-title-section">Thumbnails</h3>
      <InspectorThumbnailRowsPending />
    </section>
  )
}

function InspectorThumbnailRowsPending() {
  return (
    <div className="grid gap-3 @fields:grid-cols-2">
      {Array.from({ length: INSPECTOR_THUMBNAIL_PAGE_SIZE }, (_, index) => (
        <Skeleton className="aspect-video w-full rounded-lg" key={index} />
      ))}
    </div>
  )
}
