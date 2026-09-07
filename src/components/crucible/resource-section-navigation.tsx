export const resourceSectionLinkClassName =
  "relative flex min-h-10 items-center px-3 text-body text-muted-foreground transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export const resourceSectionActiveProps = {
  className:
    "text-label text-brand-crucible-orange after:bg-brand-crucible-orange",
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
