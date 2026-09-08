export function PageHeader({
  actions,
  description,
  eyebrow,
  icon,
  title,
}: {
  actions?: React.ReactNode
  description?: string
  eyebrow?: React.ReactNode
  icon?: React.ReactNode
  title: string
}) {
  return (
    <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
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
          <h1 className="min-w-0 text-title-page break-words">{title}</h1>
        </div>
        {description ? (
          <p className="mt-2 max-w-reading text-body-prominent text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="shrink-0 self-start lg:self-end">{actions}</div>
      ) : null}
    </header>
  )
}
