import { ResourcePreviewLink } from "@/components/crucible/resource-preview-navigation"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { TableCell } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type CollectionResourceKind = "dataset" | "sample"
type SubtypeVisibility = "always" | "compact"

export function ResourceCollectionNameCell({
  className,
  kind,
  mfid,
  name,
  subtype,
  subtypeVisibility,
}: {
  className?: string
  kind: CollectionResourceKind
  mfid: string
  name: string
  subtype: string
  subtypeVisibility: SubtypeVisibility
}) {
  return (
    <TableCell className={className}>
      <ResourcePreviewLink
        aria-label={`Preview ${name}`}
        className="group/resource block min-w-0"
        mfid={mfid}
        resourceKind={kind}
        resourceName={name}
      >
        <ResourceIdentity
          className={cn(
            subtypeVisibility === "compact" &&
              "[&_[data-resource-context]]:xl:hidden"
          )}
          context={subtype}
          interactive
          kind={kind}
          name={name}
          presentation="collection"
        />
      </ResourcePreviewLink>
    </TableCell>
  )
}
