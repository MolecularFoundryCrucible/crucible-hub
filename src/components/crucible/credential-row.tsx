import type { ReactNode } from "react"

export function CredentialList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col divide-y">{children}</ul>
}

export function CredentialRow({
  actions,
  badge,
  details,
  icon,
  subtitle,
  title,
}: {
  actions?: ReactNode
  badge?: ReactNode
  details?: ReactNode
  icon: ReactNode
  subtitle?: ReactNode
  title: ReactNode
}) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-label break-words">{title}</span>
          {badge}
        </div>
        {subtitle ? <div className="min-w-0">{subtitle}</div> : null}
        {details ? (
          <p className="text-supporting text-muted-foreground">{details}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </li>
  )
}
