import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-pill-height w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-pill-inline text-label-compact whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-pill-icon-inline has-data-[icon=inline-start]:pl-pill-icon-inline aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-border bg-muted text-foreground [a]:hover:bg-action-hover",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        success:
          "border-success/25 bg-success/10 text-success dark:bg-success/15 [a]:hover:bg-success/20",
        warning:
          "border-warning/25 bg-warning/10 text-warning dark:bg-warning/15 [a]:hover:bg-warning/20",
        info: "border-info/25 bg-info/10 text-info dark:bg-info/15 [a]:hover:bg-info/20",
        destructive:
          "border-destructive/25 bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        emphasis:
          "border-border-strong bg-accent text-foreground [a]:hover:bg-action-hover",
        muted:
          "border-border text-muted-foreground [a]:hover:bg-muted [a]:hover:text-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
