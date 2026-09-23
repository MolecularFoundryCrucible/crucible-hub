import { ResourceFullPageLink } from "@/components/crucible/resource-full-page-link"
import { ResourcePreviewLink } from "@/components/crucible/resource-preview-navigation"
import { SelectableTextLink } from "@/components/crucible/selectable-text-link"
import type { ResourceType } from "@/components/crucible/resource-type-icon"
import { cn } from "@/lib/utils"

type ResourceNameLinkKind = Exclude<ResourceType, "file" | "person">

export function ResourceNameLink({
  className,
  fromProject,
  kind,
  mfid,
  name,
  navigation = "canonical",
  title,
}: {
  className?: string
  fromProject?: string
  kind: ResourceNameLinkKind
  mfid: string
  name: string
  navigation?: "canonical" | "preview"
  title?: string
}) {
  if (navigation === "preview") {
    return (
      <SelectableTextLink
        aria-label={`Preview ${name}`}
        className={cn("block", className)}
        title={title}
        render={
          <ResourcePreviewLink
            mfid={mfid}
            resourceKind={kind}
            resourceName={name}
          >
            {name}
          </ResourcePreviewLink>
        }
      />
    )
  }

  return (
    <ResourceFullPageLink
      className={cn("block", className)}
      fromProject={fromProject}
      kind={kind}
      mfid={mfid}
      name={name}
      presentation="name"
    />
  )
}

export type { ResourceNameLinkKind }
