import type { ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"

export function CredentialName({
  children,
  icon,
  name,
  subtitle,
}: {
  children?: ReactNode
  icon: ReactNode
  name: ReactNode
  subtitle?: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="flex h-5 shrink-0 items-center text-muted-foreground [&_svg]:size-icon-label">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5 whitespace-normal">
        <span className="flex min-w-0 items-center gap-1.5 text-label break-words">
          {name}
        </span>
        {subtitle ? (
          <span className="min-w-0 text-supporting break-words text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
        {children ? (
          <span className="text-supporting text-muted-foreground">
            {children}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function CredentialTablePending({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="flex flex-col gap-3 px-(--card-spacing) py-2"
      role="status"
    >
      {[0, 1].map((row) => (
        <div className="flex items-center gap-3" key={row}>
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 @md:block" />
          <Skeleton className="size-8" />
        </div>
      ))}
    </div>
  )
}
