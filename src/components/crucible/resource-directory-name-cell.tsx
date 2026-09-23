import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceNameLink } from "@/components/crucible/resource-name-link"
import { TableCell } from "@/components/ui/table"

type DirectoryResourceKind = "instrument" | "project"

export function ResourceDirectoryNameCell({
  identifier,
  kind,
  mfid,
  name,
}: {
  identifier?: string | null
  kind: DirectoryResourceKind
  mfid: string
  name: string
}) {
  return (
    <TableCell className="resource-directory-name">
      <ResourceIdentity
        context={identifier && identifier !== name ? identifier : null}
        kind={kind}
        name={name}
        nameContent={<ResourceNameLink kind={kind} mfid={mfid} name={name} />}
        presentation="collection"
      />
    </TableCell>
  )
}
