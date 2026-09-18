import { BreakableText } from "@/components/crucible/breakable-text"
import { cn } from "@/lib/utils"

export function PageHeader({
  actionLayout = "stacked",
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
          : "flex flex-col lg:flex-row lg:items-end lg:justify-between"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-2">
          {icon}
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
        <div
          className={cn(
            "shrink-0",
            actionLayout === "inline" ? "self-end" : "self-start lg:self-end"
          )}
        >
          {actions}
        </div>
      ) : null}
    </header>
  )
}
