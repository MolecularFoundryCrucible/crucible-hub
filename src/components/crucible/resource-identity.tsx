import { BreakableText } from "@/components/crucible/breakable-text"
import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
import { MfidText } from "@/components/crucible/mfid-text"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import type { ResourceType } from "@/components/crucible/resource-type-icon"
import { cn } from "@/lib/utils"

type ResourceIdentityPresentation = "collection" | "stacked"

export function ResourceIdentity({
  className,
  context,
  interactive = false,
  kind,
  mfid,
  name,
  presentation = "stacked",
  projectId,
  showTypeIcon = true,
  showTruncationTitle = true,
}: {
  className?: string
  context?: string | null
  interactive?: boolean
  kind: ResourceType
  mfid?: string | null
  name: string
  presentation?: ResourceIdentityPresentation
  projectId?: string | null
  showTypeIcon?: boolean
  showTruncationTitle?: boolean
}) {
  const truncate = presentation === "collection"

  return (
    <span className={cn("flex min-w-0 items-start gap-2", className)}>
      {showTypeIcon ? (
        <ResourceTypeIcon className="mt-0.5 shrink-0" type={kind} />
      ) : null}
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            "block text-label",
            truncate ? "truncate" : "wrap-break-word",
            interactive && "group-hover/resource:underline"
          )}
          title={truncate && showTruncationTitle ? name : undefined}
          data-directory-name
        >
          {truncate ? name : <BreakableText value={name} />}
        </span>
        {context || projectId ? (
          <span
            className="flex min-w-0 items-center gap-2 text-supporting text-muted-foreground"
            data-resource-context
          >
            {projectId ? (
              <>
                <ResourceTypeIcon className="size-4 shrink-0" type="project" />
                <span className="sr-only">Project ID:</span>
                <span
                  className={cn("min-w-0", truncate && "truncate")}
                  title={
                    truncate && showTruncationTitle ? projectId : undefined
                  }
                >
                  {truncate ? projectId : <BreakableText value={projectId} />}
                </span>
              </>
            ) : null}
            {projectId && context ? (
              <span aria-hidden="true" className="shrink-0">
                ·
              </span>
            ) : null}
            {context ? (
              <span
                className={cn("min-w-0", truncate && "truncate")}
                title={truncate && showTruncationTitle ? context : undefined}
              >
                {truncate ? context : <BreakableText value={context} />}
              </span>
            ) : null}
          </span>
        ) : null}
        {mfid ? (
          <span className="mt-1 flex min-w-0 items-center gap-2 text-muted-foreground">
            <IdentityFieldIcon className="mt-0" type="mfid" />
            <span className="sr-only">MFID:</span>
            <MfidText
              className={cn("min-w-0", truncate ? "truncate" : "break-all")}
              presentation={truncate ? "supporting" : "default"}
              value={mfid}
            />
          </span>
        ) : null}
      </span>
    </span>
  )
}

export type { ResourceIdentityPresentation }
