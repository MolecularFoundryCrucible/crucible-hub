import { ResourcePreviewLink } from "@/components/crucible/resource-preview-navigation"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
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
        className="group flex min-w-0 items-center gap-2"
        mfid={mfid}
        resourceKind={kind}
      >
        <ResourceTypeIcon className="shrink-0" type={kind} />
        <div className="min-w-0 flex-1">
          <span
            className="block truncate text-label group-hover:underline"
            title={name}
          >
            {name}
          </span>
          <span
            className={cn(
              "block truncate text-supporting text-muted-foreground",
              subtypeVisibility === "compact" && "xl:hidden"
            )}
          >
            {subtype}
          </span>
        </div>
      </ResourcePreviewLink>
    </TableCell>
  )
}
