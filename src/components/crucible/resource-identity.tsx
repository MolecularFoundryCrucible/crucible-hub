import type { ReactNode } from "react"

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
  instrumentId,
  kind,
  mfid,
  name,
  nameContent,
  presentation = "stacked",
  projectId,
  showTypeIcon = true,
  showTruncationTitle = true,
}: {
  className?: string
  context?: string | null
  instrumentId?: string | null
  kind: ResourceType
  mfid?: string | null
  name: string
  nameContent?: ReactNode
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
            truncate ? "truncate [&>*]:block [&>*]:truncate" : "wrap-break-word"
          )}
          title={truncate && showTruncationTitle ? name : undefined}
          data-directory-name
        >
          {nameContent ?? (truncate ? name : <BreakableText value={name} />)}
        </span>
        {context || projectId || instrumentId ? (
          <span
            className="flex min-w-0 items-center gap-2 text-supporting text-muted-foreground"
            data-resource-context
          >
            {projectId ? (
              <ResourceIdentifier
                label="Project ID:"
                showTitle={truncate && showTruncationTitle}
                truncate={truncate}
                type="project"
                value={projectId}
              />
            ) : instrumentId ? (
              <ResourceIdentifier
                label="Instrument ID:"
                showTitle={truncate && showTruncationTitle}
                truncate={truncate}
                type="instrument"
                value={instrumentId}
              />
            ) : null}
            {(projectId || instrumentId) && context ? (
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
            <IdentityFieldIcon
              className="mt-0 size-icon-supporting"
              type="mfid"
            />
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

function ResourceIdentifier({
  label,
  showTitle,
  truncate,
  type,
  value,
}: {
  label: string
  showTitle: boolean
  truncate: boolean
  type: "instrument" | "project"
  value: string
}) {
  return (
    <>
      <ResourceTypeIcon className="size-icon-supporting" type={type} />
      <span className="sr-only">{label}</span>
      <span
        className={cn("min-w-0", truncate && "truncate")}
        title={showTitle ? value : undefined}
      >
        {truncate ? value : <BreakableText value={value} />}
      </span>
    </>
  )
}
