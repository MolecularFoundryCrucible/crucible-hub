import { LoadingMoreIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"

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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-supporting text-muted-foreground" role="status">
        {progress}
      </p>
      {hasNextPage ? (
        <Button
          aria-describedby={isError ? `${label}-load-more-error` : undefined}
          disabled={disabled || isLoading}
          onClick={onLoadMore}
          type="button"
          variant="outline"
        >
          {isLoading ? (
            <LoadingMoreIcon
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
              data-icon="inline-start"
            />
          ) : null}
          {isError ? `Retry loading ${label}` : `Load more ${label}`}
        </Button>
      ) : null}
      {isError ? (
        <p
          className="basis-full text-supporting text-destructive"
          id={`${label}-load-more-error`}
          role="alert"
        >
          More {label} could not be loaded. The loaded results remain available.
        </p>
      ) : null}
    </div>
  )
}
