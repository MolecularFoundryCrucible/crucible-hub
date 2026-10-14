import { BrandMark } from "@/components/crucible/brand-mark"
import {
  DiscordIcon,
  discordInviteUrl,
} from "@/components/crucible/discord-icon"
import { SystemStatusPopover } from "@/components/crucible/system-status-popover"
import { hubBuild } from "@/lib/build-info"
import type { HubBuild } from "@/lib/build-info"
import { cn } from "@/lib/utils"

const REPOSITORY_URL =
  "https://github.com/MolecularFoundryCrucible/crucible-hub"

interface AppFooterProps {
  build?: HubBuild
  className?: string
}

function buildReference(build: HubBuild) {
  if (!build.development) {
    return {
      href: `${REPOSITORY_URL}/tree/v${build.version}`,
      label: `Version ${build.version}`,
      value: `v${build.version}`,
    }
  }
  return build.commit
    ? {
        href: `${REPOSITORY_URL}/commit/${build.commit}`,
        label: `Revision ${build.commit}`,
        value: build.commit,
      }
    : undefined
}

export function AppFooter({ build = hubBuild, className }: AppFooterProps) {
  const currentYear = new Date().getFullYear()
  const reference = buildReference(build)

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
            className="inline-flex items-center gap-1.5 rounded-sm py-1 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            href={discordInviteUrl}
            rel="noreferrer"
            target="_blank"
          >
            <DiscordIcon className="size-4" />
            Discord
          </a>
          <span aria-hidden="true" className="select-none">
            •
          </span>
          <a
            className="inline-flex items-center rounded-sm py-1 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            href={`${REPOSITORY_URL}/issues`}
            rel="noreferrer"
            target="_blank"
          >
            Issues
          </a>
        </nav>

        <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 md:justify-end">
          <SystemStatusPopover build={build} />
          {reference ? (
            <>
              <span aria-hidden="true" className="select-none">
                •
              </span>
              <a
                aria-label={reference.label}
                className="inline-flex items-center rounded-sm py-1 tabular-nums transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                href={reference.href}
                rel="noreferrer"
                target="_blank"
              >
                {reference.value}
              </a>
            </>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
