import type { ReactElement } from "react"
import { Link } from "@tanstack/react-router"

import { CreateResourceIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"

export function ResourceCreationLink({
  label,
  render,
  size = "default",
  variant = "default",
}: {
  label: string
  render: ReactElement
  size?: "default" | "sm"
  variant?: "default" | "outline"
}) {
  return (
    <Button nativeButton={false} render={render} size={size} variant={variant}>
      <CreateResourceIcon aria-hidden="true" data-icon="inline-start" />
      {label}
    </Button>
  )
}

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
        <ResourceCreationLink
          label="Create sample"
          render={<Link search={{ projectMfid }} to="/samples/new" />}
        />
      ) : null}
      {kinds.includes("dataset") ? (
        <ResourceCreationLink
          label="Create dataset"
          render={
            <Link search={{ instrumentMfid, projectMfid }} to="/datasets/new" />
          }
        />
      ) : null}
    </div>
  )
}
