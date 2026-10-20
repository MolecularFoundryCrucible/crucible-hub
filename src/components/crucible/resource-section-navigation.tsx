export const resourceSectionLinkClassName =
  "relative flex min-h-10 shrink-0 items-center rounded-md px-1.5 text-label text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-3"

export const resourceSectionActiveProps = {
  className:
    "text-foreground! after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-selection after:content-['']",
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
    <div className="-mt-(--spacing-resource-navigation-offset) flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-2">
      <nav
        aria-label={label}
        className="flex max-w-full min-w-0 gap-0 overflow-x-auto sm:gap-1"
      >
        {children}
      </nav>
      {actions ? (
        <div className="ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export function ResourceSectionPanel({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="resource-section-panel min-w-0">{children}</div>
}
