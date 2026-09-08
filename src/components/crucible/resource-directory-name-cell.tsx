import { Link } from "@tanstack/react-router"

import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
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
    <>
      <ResourceTypeIcon className="shrink-0" type={kind} />
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-label group-hover:underline"
          data-directory-name
          title={name}
        >
          {name}
        </span>
        {identifier && identifier !== name ? (
          <span
            className="block truncate text-supporting text-muted-foreground"
            title={identifier}
          >
            {identifier}
          </span>
        ) : null}
      </span>
    </>
  )

  return (
    <TableCell className="resource-directory-name">
      {kind === "project" ? (
        <Link
          className="group flex min-w-0 items-center gap-2"
          params={{ projectMfid: mfid }}
          to="/projects/$projectMfid"
        >
          {identity}
        </Link>
      ) : (
        <Link
          className="group flex min-w-0 items-center gap-2"
          params={{ instrumentMfid: mfid }}
          to="/instruments/$instrumentMfid"
        >
          {identity}
        </Link>
      )}
    </TableCell>
  )
}
