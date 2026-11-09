import { useRef } from "react"

import { DatasetThumbnailImage } from "@/components/crucible/dataset-thumbnail"
import { NextImageIcon, PreviousImageIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { WorkspaceDatasetThumbnail } from "@/data/crucible/workspace-source"

const swipeDistance = 48

export function ThumbnailViewer({
  index,
  onIndexChange,
  thumbnails,
}: {
  index: number | null
  onIndexChange: (index: number | null) => void
  thumbnails: readonly WorkspaceDatasetThumbnail[]
}) {
  const thumbnail = index === null ? undefined : thumbnails[index]
  const count = thumbnails.length
  const current = index ?? 0
  const hasPrevious = current > 0
  const hasNext = current < count - 1
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  function step(offset: -1 | 1) {
    if (offset < 0 ? hasPrevious : hasNext) onIndexChange(current + offset)
  }

  return (
    <Dialog
      onOpenChange={(open) => !open && onIndexChange(null)}
      open={Boolean(thumbnail)}
    >
      <DialogContent
        className="sm:max-w-2xl"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault()
            step(event.key === "ArrowLeft" ? -1 : 1)
          }
        }}
      >
        {thumbnail ? (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle className="break-words">
                {thumbnail.thumbnail_name}
              </DialogTitle>
            </DialogHeader>
            <div
              className="touch-pan-y"
              onTouchEnd={(event) => {
                const start = swipeStart.current
                const touch = event.changedTouches[0]
                swipeStart.current = null
                if (!start) return
                const dx = touch.clientX - start.x
                const dy = touch.clientY - start.y
                if (Math.abs(dx) < swipeDistance || Math.abs(dx) < Math.abs(dy))
                  return
                step(dx < 0 ? 1 : -1)
              }}
              onTouchStart={(event) => {
                const touch = event.touches[0]
                swipeStart.current =
                  event.touches.length === 1
                    ? { x: touch.clientX, y: touch.clientY }
                    : null
              }}
            >
              <DatasetThumbnailImage
                alt={thumbnail.thumbnail_name}
                className="mx-auto h-auto max-h-dialog-media w-full max-w-128 rounded-md object-contain"
                thumbnail={thumbnail}
              />
            </div>
            {count > 1 ? (
              <div className="flex items-center justify-between gap-2">
                <Button
                  disabled={!hasPrevious}
                  onClick={() => onIndexChange(current - 1)}
                  size="sm"
                  variant="outline"
                >
                  <PreviousImageIcon
                    aria-hidden="true"
                    data-icon="inline-start"
                  />
                  Previous
                </Button>
                <span className="text-supporting text-muted-foreground tabular-nums">
                  {current + 1} of {count}
                </span>
                <Button
                  disabled={!hasNext}
                  onClick={() => onIndexChange(current + 1)}
                  size="sm"
                  variant="outline"
                >
                  Next
                  <NextImageIcon aria-hidden="true" data-icon="inline-end" />
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
