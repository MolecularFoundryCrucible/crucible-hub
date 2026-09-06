import { Skeleton } from "@/components/ui/skeleton"

export function RouteContentPending() {
  return (
    <div
      aria-label="Loading page"
      className="min-h-state flex flex-col gap-page-section"
      role="status"
    >
      <div className="flex max-w-reading flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  )
}
