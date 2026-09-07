export function PageHeader({
  actions,
  description,
  eyebrow,
  title,
}: {
  actions?: React.ReactNode
  description?: string
  eyebrow: React.ReactNode
  title: string
}) {
  return (
    <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-reading min-w-0 flex-1">
        <div className="flex items-center gap-2 text-overline text-muted-foreground uppercase">
          {eyebrow}
        </div>
        <h1 className="mt-2 text-title-page break-words">{title}</h1>
        {description ? (
          <p className="mt-2 text-body-prominent text-muted-foreground">
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
