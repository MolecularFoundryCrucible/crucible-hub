import { BrandMark } from "@/components/crucible/brand-mark"
import { SystemStatusPopover } from "@/components/crucible/system-status-popover"
import { cn } from "@/lib/utils"

interface AppFooterProps {
  className?: string
  gitRevision?: string
}

export function AppFooter({ className, gitRevision }: AppFooterProps) {
  const currentYear = new Date().getFullYear()
  const revision =
    gitRevision ??
    (typeof import.meta.env.VITE_GIT_COMMIT === "string" &&
    import.meta.env.VITE_GIT_COMMIT.length > 0
      ? import.meta.env.VITE_GIT_COMMIT
      : undefined)

  return (
    <footer
      aria-label="Crucible Hub footer"
      className={cn(
        "mt-auto w-full border-t border-border bg-background/50",
        className
      )}
      role="contentinfo"
    >
      <div className="mx-auto flex w-full max-w-content flex-col items-center gap-y-4 px-page-gutter py-6 text-center text-supporting text-muted-foreground sm:px-page-gutter-medium md:flex-row md:items-center md:justify-between md:text-left lg:px-page-gutter-wide">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 md:justify-start">
          <BrandMark className="size-4 translate-y-px" variant="icon" />
          <span>© {currentYear} Crucible Dev Team</span>
        </div>

        <nav
          aria-label="External resources"
          className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1"
        >
          <a
            className="inline-flex items-center rounded-sm py-1 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            href="https://crucible.lbl.gov/"
            rel="noreferrer"
            target="_blank"
          >
            Crucible
          </a>
          <span aria-hidden="true" className="select-none">
            •
          </span>
          <a
            className="inline-flex items-center rounded-sm py-1 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            href="https://foundry.lbl.gov/"
            rel="noreferrer"
            target="_blank"
          >
            Molecular Foundry
          </a>
          <span aria-hidden="true" className="select-none">
            •
          </span>
          <a
            className="inline-flex items-center rounded-sm py-1 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            href="https://github.com/MolecularFoundryCrucible/crucible-hub/issues"
            rel="noreferrer"
            target="_blank"
          >
            Issues
          </a>
        </nav>

        <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 md:justify-end">
          <SystemStatusPopover gitRevision={revision} />
          {revision ? (
            <>
              <span aria-hidden="true" className="select-none">
                •
              </span>
              <div className="flex items-center gap-1.5">
                <span>Revision</span>
                <a
                  className="inline-flex items-center rounded-sm py-1 font-mono transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  href={`https://github.com/MolecularFoundryCrucible/crucible-hub/commit/${revision}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {revision}
                </a>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
