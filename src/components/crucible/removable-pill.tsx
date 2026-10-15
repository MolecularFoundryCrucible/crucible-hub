import type { ComponentProps } from "react"

import { RemoveFilterIcon } from "@/components/crucible/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface RemovablePillProps extends Omit<
  ComponentProps<typeof Button>,
  "size" | "variant"
> {
  icon?: React.ComponentType<{
    "aria-hidden"?: boolean | "true" | "false"
    className?: string
    "data-icon"?: "inline-end" | "inline-start"
  }>
  label: string
  onRemove: () => void
  removeAriaLabel?: string
}

export function RemovablePill({
  className,
  disabled,
  icon: Icon = RemoveFilterIcon,
  label,
  onRemove,
  removeAriaLabel,
  ...props
}: RemovablePillProps) {
  return (
    <Button
      aria-label={removeAriaLabel ?? `Remove ${label}`}
      className={cn("truncate", className)}
      disabled={disabled}
      onClick={onRemove}
      size="pill"
      type="button"
      variant="outline"
      {...props}
    >
      <span className="truncate">{label}</span>
      <Icon aria-hidden="true" data-icon="inline-end" />
    </Button>
  )
}
