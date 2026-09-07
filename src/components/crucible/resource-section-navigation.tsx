export const resourceSectionLinkClassName =
  "flex min-h-10 items-center border-b-2 border-transparent px-3 text-body text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export const resourceSectionActiveProps = {
  className: "border-brand-crucible-orange text-label text-foreground",
}

export function ResourceSectionNavigation({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <nav aria-label={label} className="flex gap-1 border-b">
      {children}
    </nav>
  )
}
