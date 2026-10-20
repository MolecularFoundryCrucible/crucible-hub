import { useRender } from "@base-ui/react/use-render"
import type { ReactElement } from "react"
import { Link } from "@tanstack/react-router"

import { CreateResourceIcon } from "@/components/crucible/icons"
import { buttonVariants } from "@/components/ui/button"

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
  return useRender({
    defaultTagName: "a",
    props: {
      children: (
        <>
          <CreateResourceIcon aria-hidden="true" data-icon="inline-start" />
          {label}
        </>
      ),
      className: buttonVariants({ size, variant }),
    },
    render,
    state: { slot: "button" },
  })
}

export function ResourceCreationActions({
  instrumentMfid,
  kinds = ["sample", "dataset"],
  projectMfid,
  variant = "default",
}: {
  instrumentMfid?: string
  kinds?: readonly ("dataset" | "sample")[]
  projectMfid?: string
  variant?: "default" | "outline"
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {kinds.includes("sample") ? (
        <ResourceCreationLink
          label="Create sample"
          variant={variant}
          render={<Link search={{ projectMfid }} to="/samples/new" />}
        />
      ) : null}
      {kinds.includes("dataset") ? (
        <ResourceCreationLink
          label="Create dataset"
          variant={variant}
          render={
            <Link search={{ instrumentMfid, projectMfid }} to="/datasets/new" />
          }
        />
      ) : null}
    </div>
  )
}
