import { BreakableText } from "@/components/crucible/breakable-text"
import { cn } from "@/lib/utils"

export function PageHeader({
  actionLayout = "stacked",
  actions,
  description,
  eyebrow,
  icon,
  title,
}: {
  actionLayout?: "inline" | "stacked"
  actions?: React.ReactNode
  description?: string
  eyebrow?: React.ReactNode
  icon?: React.ReactNode
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
        {eyebrow ? (
          <div className="flex items-center gap-2 text-overline text-muted-foreground uppercase">
            {eyebrow}
          </div>
        ) : null}
        <div
          className={
            eyebrow
              ? "mt-2 flex min-w-0 items-start gap-2"
              : "flex min-w-0 items-start gap-2"
          }
        >
          {icon}
          <h1 className="min-w-0 text-title-page break-words">
            <BreakableText value={title} />
          </h1>
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
