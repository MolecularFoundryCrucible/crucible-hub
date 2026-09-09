import { IdentityFieldIcon } from "@/components/crucible/identity-field-icon"
import { MfidText } from "@/components/crucible/mfid-text"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import type { ResourceType } from "@/components/crucible/resource-type-icon"
import { cn } from "@/lib/utils"

type ResourceIdentityPresentation = "collection" | "stacked"

export function ResourceIdentity({
  className,
  context,
  contextKind,
  interactive = false,
  kind,
  mfid,
  name,
  presentation = "stacked",
}: {
  className?: string
  context?: string | null
  contextKind?: ResourceType
  interactive?: boolean
  kind: ResourceType
  mfid?: string | null
  name: string
  presentation?: ResourceIdentityPresentation
}) {
  const truncate = presentation === "collection"

  return (
    <span className={cn("flex min-w-0 items-start gap-2", className)}>
      <ResourceTypeIcon className="mt-0.5 shrink-0" type={kind} />
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            "block text-label",
            truncate ? "truncate" : "wrap-break-word",
            interactive && "group-hover/resource:underline"
          )}
          title={truncate ? name : undefined}
          data-directory-name
        >
          {name}
        </span>
        {context ? (
          <span
            className="flex min-w-0 items-center gap-2 text-supporting text-muted-foreground"
            data-resource-context
          >
            {contextKind ? (
              <ResourceTypeIcon
                className="size-4 shrink-0"
                type={contextKind}
              />
            ) : null}
            <span
              className={cn(truncate && "truncate")}
              title={truncate ? context : undefined}
            >
              {context}
            </span>
          </span>
        ) : null}
        {mfid ? (
          <span className="mt-1 flex min-w-0 items-center gap-2 text-muted-foreground">
            <IdentityFieldIcon className="mt-0" type="mfid" />
            <span className="sr-only">MFID:</span>
            <MfidText
              className={cn("min-w-0", truncate ? "truncate" : "break-all")}
              value={mfid}
            />
          </span>
        ) : null}
      </span>
    </span>
  )
}

export type { ResourceIdentityPresentation }
