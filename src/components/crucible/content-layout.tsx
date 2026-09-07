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
        detail: "grid grid-cols-1 xl:grid-cols-5",
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
      wide: "xl:col-span-3",
      narrow: "xl:col-span-2",
      full: "xl:col-span-5",
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
  return (
    <div
      data-slot="content-grid"
      className={cn(contentGridVariants({ variant }), className)}
      {...props}
    />
  )
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
