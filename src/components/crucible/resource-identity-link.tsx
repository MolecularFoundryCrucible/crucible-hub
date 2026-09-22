import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"

import { IdentityHoverCard } from "@/components/crucible/identity-hover-card"
import { MfidText } from "@/components/crucible/mfid-text"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import type { ResourceIdentityPresentation } from "@/components/crucible/resource-identity"
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
  const identity = (
    <ResourceIdentity
      context={triggerContext}
      interactive
      kind={kind}
      name={name}
      presentation={presentation}
      showTypeIcon={showTypeIcon}
      showTruncationTitle={false}
    />
  )
  const linkClassName = cn("group/resource block min-w-0", className)
  const link =
    kind === "project" ? (
      <Link
        className={linkClassName}
        params={{ projectMfid: mfid }}
        search={{ preview: undefined }}
        state={{}}
        to="/projects/$projectMfid"
      >
        {children ?? identity}
      </Link>
    ) : (
      <Link
        className={linkClassName}
        params={{ instrumentMfid: mfid }}
        search={{}}
        state={{}}
        to="/instruments/$instrumentMfid"
      >
        {children ?? identity}
      </Link>
    )

  return (
    <IdentityHoverCard trigger={link}>
      <ResourceIdentity context={context} kind={kind} name={name} />
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
}
