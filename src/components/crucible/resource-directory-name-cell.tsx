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
  return (
    <TableCell className="resource-directory-name">
      {kind === "project" ? (
        <Link
          className="group/resource block min-w-0"
          params={{ projectMfid: mfid }}
          search={{ preview: undefined }}
          state={{}}
          to="/projects/$projectMfid"
        >
          <ResourceIdentity
            context={identifier && identifier !== name ? identifier : null}
            interactive
            kind="project"
            name={name}
            presentation="collection"
          />
        </Link>
      ) : (
        <Link
          className="group/resource block min-w-0"
          params={{ instrumentMfid: mfid }}
          search={{}}
          state={{}}
          to="/instruments/$instrumentMfid"
        >
          <ResourceIdentity
            context={identifier && identifier !== name ? identifier : null}
            interactive
            kind="instrument"
            name={name}
            presentation="collection"
          />
        </Link>
      )}
    </TableCell>
  )
}
