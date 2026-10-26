import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ManagementAction({
  action,
  busy,
  children,
  description,
  presentation = "card",
  title,
}: {
  action: React.ReactNode
  busy?: boolean
  children?: React.ReactNode
  description?: React.ReactNode
  presentation?: "card" | "row"
  title: React.ReactNode
}) {
  const content = (
    <>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 @fields:flex-nowrap">
        <div className="min-w-0 flex-1 basis-40 space-y-1">
          <h3 className="min-w-0 font-heading text-title-section break-words">
            {title}
          </h3>
          {description ? (
            <div className="min-w-0 text-body break-words text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {children}
    </>
  )

  if (presentation === "row") {
    return (
      <section
        aria-busy={busy || undefined}
        className="flex min-w-0 flex-col gap-4 px-4 py-4"
      >
        {content}
      </section>
    )
  }

  return (
    <Card aria-busy={busy || undefined}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardAction>{action}</CardAction>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  )
}
