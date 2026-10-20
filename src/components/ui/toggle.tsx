import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ToggleSize = "default" | "lg" | "sm"

function toggleClasses({
  className,
  size = "default",
}: {
  className?: string
  size?: ToggleSize
}) {
  return buttonVariants({
    className: cn(
      "data-pressed:border-border-strong data-pressed:bg-action-selected data-pressed:shadow-xs data-pressed:hover:bg-action-selected",
      className
    ),
    size,
    variant: "ghost",
  })
}

function Toggle({
  className,
  size = "default",
  ...props
}: Omit<TogglePrimitive.Props, "className"> & {
  className?: string
  size?: ToggleSize
}) {
  return (
    <TogglePrimitive
      className={toggleClasses({ className, size })}
      data-slot="toggle"
      {...props}
    />
  )
}

export { Toggle, toggleClasses }
export type { ToggleSize }
