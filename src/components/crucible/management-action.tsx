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
  description: React.ReactNode
  presentation?: "card" | "row"
  title: React.ReactNode
}) {
  const content = (
    <>
      <div className="grid min-w-0 grid-cols-1 items-start gap-1 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <h3 className="font-heading text-title-section">{title}</h3>
          <div className="mt-1 text-body text-muted-foreground">
            {description}
          </div>
        </div>
        <div className="mt-3 w-full sm:mt-0 sm:w-auto">{action}</div>
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
        <CardDescription>{description}</CardDescription>
        <CardAction>{action}</CardAction>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  )
}
