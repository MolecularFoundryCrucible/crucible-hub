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

  return (
    <Dialog
      onOpenChange={(open) => !open && onIndexChange(null)}
      open={Boolean(thumbnail)}
    >
      <DialogContent
        className="sm:max-w-2xl"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" && hasPrevious) {
            event.preventDefault()
            onIndexChange(current - 1)
          } else if (event.key === "ArrowRight" && hasNext) {
            event.preventDefault()
            onIndexChange(current + 1)
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
            <DatasetThumbnailImage
              alt={thumbnail.thumbnail_name}
              className="mx-auto h-auto max-h-dialog-media w-full max-w-128 rounded-md object-contain"
              thumbnail={thumbnail}
            />
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
