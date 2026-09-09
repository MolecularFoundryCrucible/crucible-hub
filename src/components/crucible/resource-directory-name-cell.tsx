import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import type { ResourceIdentityDetail } from "@/components/crucible/resource-identity-link"
import { TableCell } from "@/components/ui/table"

type DirectoryResourceKind = "instrument" | "project"

export function ResourceDirectoryNameCell({
  details,
  identifier,
  kind,
  mfid,
  name,
}: {
  details?: readonly ResourceIdentityDetail[]
  identifier?: string | null
  kind: DirectoryResourceKind
  mfid: string
  name: string
}) {
  return (
    <TableCell className="resource-directory-name">
      <ResourceIdentityLink
        context={identifier && identifier !== name ? identifier : null}
        details={details}
        kind={kind}
        mfid={mfid}
        name={name}
      />
    </TableCell>
  )
}
