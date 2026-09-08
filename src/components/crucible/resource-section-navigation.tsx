export const resourceSectionLinkClassName =
  "relative flex min-h-10 items-center rounded-md px-3 text-label text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export const resourceSectionActiveProps = {
  className:
    "text-foreground! after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand-crucible-orange after:content-['']",
}

export function ResourceSectionNavigation({
  actions,
  label,
  children,
}: {
  actions?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="-mt-(--spacing-resource-navigation-offset) flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <nav aria-label={label} className="flex min-w-0 gap-1">
        {children}
      </nav>
      {actions ? (
        <div className="ml-auto min-w-0 max-sm:w-full sm:shrink-0 max-sm:[&>*]:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
