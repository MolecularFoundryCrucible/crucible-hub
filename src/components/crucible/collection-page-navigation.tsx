import type { ReactNode } from "react"

export function CollectionPageNavigation({
  label,
  next,
  previous,
}: {
  label: string
  next?: ReactNode
  previous?: ReactNode
}) {
  if (!previous && !next) return null

  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      {previous}
      {next}
    </nav>
  )
}
