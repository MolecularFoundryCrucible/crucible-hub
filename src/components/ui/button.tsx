import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariantClasses = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding font-sans text-label whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 motion-safe:active:not-aria-[haspopup]:translate-y-px motion-safe:aria-busy:translate-y-px dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border-action-border bg-action-surface text-foreground shadow-xs hover:bg-action-hover in-data-[slot=button-group]:border-border-strong aria-expanded:bg-action-hover aria-pressed:bg-action-pressed aria-pressed:hover:bg-action-pressed",
        ghost:
          "border-transparent hover:bg-action-hover hover:text-foreground aria-expanded:bg-action-hover aria-expanded:text-foreground aria-pressed:bg-action-pressed aria-pressed:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive shadow-xs hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        "destructive-solid":
          "border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/30 dark:focus-visible:ring-destructive/40",
        warning:
          "border-warning/30 bg-warning/10 text-warning shadow-xs hover:bg-warning/20 focus-visible:border-warning/50 focus-visible:ring-warning/25 dark:bg-warning/15 dark:hover:bg-warning/25",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 max-md:has-[>.hidden]:w-8 max-md:has-[>.hidden]:px-0",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-label-compact in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-label-compact in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-circle":
          "size-7 rounded-full [&_svg:not([class*='size-'])]:size-3.5",
        pill: "h-pill-height max-w-full gap-1 rounded-4xl px-pill-inline text-label-compact [&_svg:not([class*='size-'])]:size-3",
        floating:
          "size-11 gap-1.5 px-0 sm:w-auto sm:px-3 sm:has-data-[icon=inline-end]:pr-2.5 sm:has-data-[icon=inline-start]:pl-2.5",
        qr: "size-28 overflow-hidden p-0",
        "table-header":
          "h-7 gap-1 rounded-[min(var(--radius-md),12px)] border-0 px-2 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        "table-action":
          "size-7 rounded-[min(var(--radius-md),12px)] max-md:size-9 md:[&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    compoundVariants: [
      {
        variant: "outline",
        size: ["icon", "icon-xs", "icon-sm", "icon-circle", "table-action"],
        className: "border-border-strong",
      },
      {
        variant: "outline",
        size: "default",
        className: "max-md:has-[>.hidden]:border-border-strong",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const buttonVariants = (...args: Parameters<typeof buttonVariantClasses>) =>
  cn(buttonVariantClasses(...args))

function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton = true,
  type = nativeButton ? "button" : undefined,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      nativeButton={nativeButton}
      type={type}
      {...props}
    />
  )
}

export { Button, buttonVariants }
