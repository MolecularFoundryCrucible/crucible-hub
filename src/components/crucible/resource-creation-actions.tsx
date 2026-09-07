import { Link } from "@tanstack/react-router"

import { CreateResourceIcon } from "@/components/crucible/icons"
import { buttonVariants } from "@/components/ui/button"

export function ResourceCreationActions({
  instrumentMfid,
  kinds = ["sample", "dataset"],
  projectMfid,
}: {
  instrumentMfid?: string
  kinds?: readonly ("dataset" | "sample")[]
  projectMfid?: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {kinds.includes("sample") ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          search={{ projectMfid }}
          to="/samples/new"
        >
          <CreateResourceIcon data-icon="inline-start" />
          Create sample
        </Link>
      ) : null}
      {kinds.includes("dataset") ? (
        <Link
          className={buttonVariants({ variant: "outline" })}
          search={{ instrumentMfid, projectMfid }}
          to="/datasets/new"
        >
          <CreateResourceIcon data-icon="inline-start" />
          Create dataset
        </Link>
      ) : null}
    </div>
  )
}
