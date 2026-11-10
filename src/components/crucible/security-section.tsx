import { createContext, useContext, useId } from "react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export const SecuritySectionInTab = createContext(false)

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
  const inTab = useContext(SecuritySectionInTab)
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex scroll-mt-20 flex-col gap-2",
        !inTab && "border-t pt-4 first:border-t-0 first:pt-0"
      )}
      id={id}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 px-(--card-spacing)",
          inTab ? (action ? "min-h-8 justify-end" : "sr-only") : "min-h-8"
        )}
      >
        <h2
          className={cn("font-heading text-label", inTab && "sr-only")}
          id={headingId}
        >
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
