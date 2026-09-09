import { Link } from "@tanstack/react-router"

import { ResourceIdentity } from "@/components/crucible/resource-identity"
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
  const identity = (
    <ResourceIdentity
      context={identifier && identifier !== name ? identifier : null}
      interactive
      kind={kind}
      name={name}
      presentation="collection"
    />
  )

  return (
    <TableCell className="resource-directory-name">
      {kind === "project" ? (
        <Link
          className="group/resource block min-w-0"
          params={{ projectMfid: mfid }}
          to="/projects/$projectMfid"
        >
          {identity}
        </Link>
      ) : (
        <Link
          className="group/resource block min-w-0"
          params={{ instrumentMfid: mfid }}
          to="/instruments/$instrumentMfid"
        >
          {identity}
        </Link>
      )}
    </TableCell>
  )
}
