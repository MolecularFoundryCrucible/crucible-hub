import { useId } from "react"
import type { ReactNode } from "react"

export function SecuritySection({
  action,
  children,
  id,
  title,
}: {
  action?: ReactNode
  children: ReactNode
  id?: string
  title: string
}) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className="flex scroll-mt-20 flex-col gap-2 border-t pt-4 first:border-t-0 first:pt-0"
      id={id}
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 px-(--card-spacing)">
        <h2 className="font-heading text-label" id={headingId}>
          {title}
        </h2>
        {action ? (
          <div className="flex flex-wrap items-center gap-2">{action}</div>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function SecuritySectionMessage({
  action,
  children,
  role,
}: {
  action?: ReactNode
  children: ReactNode
  role?: "alert" | "status"
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-(--card-spacing)">
      <p className="text-body text-muted-foreground" role={role}>
        {children}
      </p>
      {action}
    </div>
  )
}
