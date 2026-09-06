export function PageHeader({
  actions,
  description,
  eyebrow,
  title,
}: {
  actions?: React.ReactNode
  description?: string
  eyebrow: string
  title: string
}) {
  return (
    <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-reading">
        <p className="text-overline text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-title-page">{title}</h1>
        {description ? (
          <p className="mt-2 text-body-prominent text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions}
    </header>
  )
}
