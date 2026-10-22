import { useEffect, useEffectEvent, useId, useRef } from "react"

import { BackToTop } from "@/components/crucible/back-to-top"
import { Button } from "@/components/ui/button"
import { DelayedPendingIcon } from "@/components/crucible/pending-icon"

const collectionLoadAheadMargin = "480px 0px"

export function CollectionPagination({
  disabled = false,
  hasNextPage,
  isError,
  isLoading,
  label,
  loaded,
  onLoadMore,
  total,
}: {
  disabled?: boolean
  hasNextPage: boolean
  isError: boolean
  isLoading: boolean
  label: string
  loaded: number
  onLoadMore: () => void
  total: number | null
}) {
  const errorId = useId()
  const loadMoreTarget = useRef<HTMLDivElement>(null)
  const requestNextPage = useEffectEvent(onLoadMore)

  useEffect(() => {
    const target = loadMoreTarget.current
    if (
      !target ||
      !hasNextPage ||
      disabled ||
      isError ||
      isLoading ||
      typeof IntersectionObserver === "undefined"
    ) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        requestNextPage()
      },
      { rootMargin: collectionLoadAheadMargin }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [disabled, hasNextPage, isError, isLoading])

  if (!loaded) return null
  const progress =
    total !== null && total >= loaded
      ? hasNextPage
        ? `Showing ${loaded} of ${total} ${label}`
        : `All ${total} ${label} shown`
      : hasNextPage
        ? `${loaded} ${label} loaded`
        : `All ${loaded} ${label} shown`
  return (
    <>
      <div
        className="flex flex-wrap items-center justify-between gap-3"
        ref={loadMoreTarget}
      >
        <p className="text-supporting text-muted-foreground" role="status">
          {progress}
        </p>
        {hasNextPage ? (
          <Button
            aria-describedby={isError ? errorId : undefined}
            disabled={disabled || isLoading}
            onClick={onLoadMore}
            type="button"
            variant="outline"
          >
            <DelayedPendingIcon data-icon="inline-start" pending={isLoading} />
            {isError ? `Retry loading ${label}` : `Load more ${label}`}
          </Button>
        ) : null}
        {isError ? (
          <p
            className="basis-full text-supporting text-destructive"
            id={errorId}
            role="alert"
          >
            More {label} could not be loaded. The loaded results remain
            available.
          </p>
        ) : null}
      </div>
      <BackToTop />
    </>
  )
}
