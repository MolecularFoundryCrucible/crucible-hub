import { BreakableText } from "@/components/crucible/breakable-text"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function PageHeader({
  actionLayout = "inline",
  actions,
  description,
  icon,
  identifier,
  title,
}: {
  actionLayout?: "inline" | "stacked"
  actions?: React.ReactNode
  description?: string
  icon?: React.ReactNode
  identifier?: string
  title: string
}) {
  return (
    <header
      className={cn(
        "gap-4 border-b pb-6",
        actionLayout === "inline"
          ? "page-header-inline grid items-end"
          : "flex flex-wrap items-end justify-between"
      )}
    >
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon ? (
            <span className="entity-icon-well entity-icon-well-lg">{icon}</span>
          ) : null}
          <div className="min-w-0">
            <h1
              className="min-w-0 scroll-mt-20 text-title-page break-words"
              data-page-top
              tabIndex={-1}
            >
              <BreakableText value={title} />
            </h1>
            {identifier ? (
              <p className="mt-1 text-identifier text-muted-foreground">
                <BreakableText value={identifier} />
              </p>
            ) : null}
          </div>
        </div>
        {description ? (
          <p className="mt-2 max-w-reading text-body-prominent text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="ml-auto shrink-0 self-end">{actions}</div>
      ) : null}
    </header>
  )
}

export function PageHeaderSkeleton({
  icon,
  identifier = false,
  label = "Loading page title",
}: {
  icon?: React.ReactNode
  identifier?: boolean
  label?: string
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon ? (
            <span className="entity-icon-well entity-icon-well-lg">{icon}</span>
          ) : null}
          <div className="min-w-0 flex-1" role="status">
            <Skeleton className="h-9 w-64 max-w-full" />
            {identifier ? (
              <Skeleton className="mt-1 h-5 w-36 max-w-full" />
            ) : null}
            <span className="sr-only">{label}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
