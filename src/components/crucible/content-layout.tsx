import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const contentBoundaryVariants = cva("w-full min-w-0", {
  variants: {
    width: {
      action: "max-w-action",
      reading: "max-w-reading",
      full: "",
    },
  },
  defaultVariants: {
    width: "full",
  },
})

const contentGridVariants = cva(
  "min-w-0 items-start gap-page-section [&>*]:min-w-0",
  {
    variants: {
      variant: {
        actions: "content-grid-actions",
        detail: "grid grid-cols-1 @3xl/content:grid-cols-7",
        detailAside:
          "grid grid-cols-1 @3xl/content:grid-cols-7 @3xl/content:grid-rows-[auto_1fr]",
        identity: "content-grid-identity grid gap-4",
        split: "grid grid-cols-1 @3xl/content:grid-cols-2",
      },
    },
    defaultVariants: {
      variant: "detail",
    },
  }
)

const contentGridItemVariants = cva("min-w-0", {
  variants: {
    span: {
      wide: "@3xl/content:col-span-4",
      narrow: "@3xl/content:col-span-3",
      full: "@3xl/content:col-span-7",
      aside: "@3xl/content:col-span-3 @3xl/content:row-span-2",
    },
  },
  defaultVariants: {
    span: "full",
  },
})

type ContentBoundaryProps = React.ComponentProps<"div"> &
  VariantProps<typeof contentBoundaryVariants>

function ContentBoundary({ className, width, ...props }: ContentBoundaryProps) {
  return (
    <div
      data-slot="content-boundary"
      className={cn(contentBoundaryVariants({ width }), className)}
      {...props}
    />
  )
}

type ContentGridProps = React.ComponentProps<"div"> &
  VariantProps<typeof contentGridVariants>

function ContentGrid({ className, variant, ...props }: ContentGridProps) {
  const grid = (
    <div
      data-slot="content-grid"
      className={cn(contentGridVariants({ variant }), className)}
      {...props}
    />
  )
  if (variant !== "identity") return grid
  return <div className="content-grid-identity-container">{grid}</div>
}

type ContentGridItemProps = React.ComponentProps<"div"> &
  VariantProps<typeof contentGridItemVariants>

function ContentGridItem({ className, span, ...props }: ContentGridItemProps) {
  return (
    <div
      data-slot="content-grid-item"
      className={cn(contentGridItemVariants({ span }), className)}
      {...props}
    />
  )
}

export { ContentBoundary, ContentGrid, ContentGridItem }
