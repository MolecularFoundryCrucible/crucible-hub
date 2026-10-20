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
      "data-pressed:border-action-border data-pressed:bg-action-surface data-pressed:shadow-xs data-pressed:hover:bg-action-hover",
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
