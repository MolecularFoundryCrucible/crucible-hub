import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"

import { IdentityHoverCard } from "@/components/crucible/identity-hover-card"
import { MfidText } from "@/components/crucible/mfid-text"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import type { ResourceIdentityPresentation } from "@/components/crucible/resource-identity"
import { SelectableTextLink } from "@/components/crucible/selectable-text-link"
import { resourceDisplayName } from "@/lib/resource-name"
import { cn } from "@/lib/utils"

export type ResourceIdentityDetail = {
  label: string
  value: ReactNode
}

export function ResourceIdentityLink({
  children,
  className,
  context,
  details = [],
  kind,
  mfid,
  name,
  presentation = "collection",
  showTypeIcon = true,
  triggerContext = context,
}: {
  children?: ReactNode
  className?: string
  context?: string | null
  details?: readonly ResourceIdentityDetail[]
  kind: "instrument" | "project"
  mfid: string
  name: string
  presentation?: ResourceIdentityPresentation
  showTypeIcon?: boolean
  triggerContext?: string | null
}) {
  const displayName = resourceDisplayName(kind, name, { mfid })
  const routeLink =
    kind === "project" ? (
      <Link
        params={{ projectMfid: mfid }}
        search={{ preview: undefined }}
        state={{}}
        to="/projects/$projectMfid"
      />
    ) : (
      <Link
        params={{ instrumentMfid: mfid }}
        search={{}}
        state={{}}
        to="/instruments/$instrumentMfid"
      />
    )
  const link = (
    <SelectableTextLink
      className={cn("group/resource block", children && className)}
      render={routeLink}
    >
      {children ?? displayName}
    </SelectableTextLink>
  )
  const hoverLink = (
    <IdentityHoverCard trigger={link}>
      <ResourceIdentity context={context} kind={kind} name={displayName} />
      <MfidText
        className="mt-2 block whitespace-nowrap text-muted-foreground"
        presentation="supporting"
        value={mfid}
      />
      {details.length ? (
        <dl className="mt-3 grid gap-2">
          {details.map((detail) => (
            <div className="min-w-0" key={detail.label}>
              <dt className="text-supporting text-muted-foreground">
                {detail.label}
              </dt>
              <dd className="mt-0.5 text-body break-words">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </IdentityHoverCard>
  )

  if (children) return hoverLink

  return (
    <ResourceIdentity
      className={className}
      context={triggerContext}
      kind={kind}
      name={displayName}
      nameContent={hoverLink}
      presentation={presentation}
      showTypeIcon={showTypeIcon}
      showTruncationTitle={false}
    />
  )
}
