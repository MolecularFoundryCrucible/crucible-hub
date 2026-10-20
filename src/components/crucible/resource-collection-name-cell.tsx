import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceNameLink } from "@/components/crucible/resource-name-link"
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
      <ResourceIdentity
        className={cn(
          subtypeVisibility === "compact" &&
            "@collection-wide:[&_[data-resource-context]]:hidden"
        )}
        context={subtype}
        kind={kind}
        name={name}
        nameContent={
          <ResourceNameLink
            kind={kind}
            mfid={mfid}
            name={name}
            navigation="preview"
          />
        }
        presentation="collection"
      />
    </TableCell>
  )
}
