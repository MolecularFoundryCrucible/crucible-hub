import { useRender } from "@base-ui/react/use-render"
import type { ReactElement } from "react"
import { Link } from "@tanstack/react-router"

import { CreateResourceIcon } from "@/components/crucible/icons"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ResourceCreationLink({
  kind,
  label,
  render,
  size = "default",
  variant = "default",
}: {
  /** Below 40 rem, shows this resource type's icon instead of the label. */
  kind?: "dataset" | "sample"
  label: string
  render: ReactElement
  size?: "default" | "sm"
  variant?: "default" | "outline"
}) {
  return useRender({
    defaultTagName: "a",
    props: {
      children: kind ? (
        <>
          <CreateResourceIcon aria-hidden="true" data-icon="inline-start" />
          <ResourceTypeIcon
            className={cn(
              "@2xl/content:hidden",
              variant === "default" && "text-current"
            )}
            type={kind}
          />
          <span className="@max-2xl/content:sr-only">{label}</span>
        </>
      ) : (
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
          kind="sample"
          label="Create sample"
          variant={variant}
          render={<Link search={{ projectMfid }} to="/samples/new" />}
        />
      ) : null}
      {kinds.includes("dataset") ? (
        <ResourceCreationLink
          kind="dataset"
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
