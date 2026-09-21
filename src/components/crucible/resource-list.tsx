import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

function ResourceList({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex min-w-0 flex-col divide-y", className)}
      data-slot="resource-list"
      role="list"
      {...props}
    />
  )
}

function ResourceListItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={cn(
        "group/resource min-w-0 transition-colors focus-within:bg-muted/50 hover:bg-muted/50",
        className
      )}
      data-slot="resource-list-item"
      {...props}
    />
  )
}

const resourceListItemContentVariants = cva(
  "flex w-full min-w-0 gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
  {
    variants: {
      density: {
        compact: "px-3 py-2.5",
        default: "px-4 py-3",
      },
      layout: {
        responsive: "flex-col sm:flex-row sm:items-start",
        row: "items-center",
        start: "items-start",
      },
    },
    defaultVariants: {
      density: "default",
      layout: "row",
    },
  }
)

function ResourceListItemContent({
  className,
  density = "default",
  layout = "row",
  render,
  ...props
}: useRender.ComponentProps<"div"> &
  VariantProps<typeof resourceListItemContentVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          resourceListItemContentVariants({ density, layout }),
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "resource-list-item-content",
    },
  })
}

export { ResourceList, ResourceListItem, ResourceListItemContent }
