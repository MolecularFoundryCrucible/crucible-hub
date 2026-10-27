import { useContext } from "react"
import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"

import { PreviewReferenceIcon } from "@/components/crucible/icons"
import { IdentityHoverCard } from "@/components/crucible/identity-hover-card"
import { MfidValue } from "@/components/crucible/mfid-value"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import type { ResourceIdentityPresentation } from "@/components/crucible/resource-identity"
import {
  ResourcePreviewContext,
  ResourcePreviewLink,
} from "@/components/crucible/resource-preview-navigation"
import { SelectableTextLink } from "@/components/crucible/selectable-text-link"
import { buttonVariants } from "@/components/ui/button"
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
  navigation = "canonical",
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
  navigation?: "canonical" | "preview"
  presentation?: ResourceIdentityPresentation
  showTypeIcon?: boolean
  triggerContext?: string | null
}) {
  const displayName = resourceDisplayName(kind, name, { mfid })
  const canPreview = useContext(ResourcePreviewContext) !== null
  const routeLink =
    navigation === "preview" ? (
      <ResourcePreviewLink
        mfid={mfid}
        resourceKind={kind}
        resourceName={displayName}
      >
        {children ?? displayName}
      </ResourcePreviewLink>
    ) : kind === "project" ? (
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
      aria-label={
        navigation === "preview" ? `Preview ${displayName}` : undefined
      }
      className={cn("group/resource block", children && className)}
      render={routeLink}
    >
      {children ?? displayName}
    </SelectableTextLink>
  )
  const hoverLink = (
    <IdentityHoverCard trigger={link}>
      <ResourceIdentity context={context} kind={kind} name={displayName} />
      <MfidValue className="mt-2" presentation="supporting" value={mfid} />
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
      {canPreview && navigation !== "preview" ? (
        <div className="mt-2 -mr-2 flex justify-end">
          <ResourcePreviewLink
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            mfid={mfid}
            resourceKind={kind}
            resourceName={displayName}
          >
            <PreviewReferenceIcon aria-hidden="true" data-icon="inline-start" />
            Preview
          </ResourcePreviewLink>
        </div>
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
