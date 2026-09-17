"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"

import { toggleClasses } from "@/components/ui/toggle"
import type { ToggleSize } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"

const ToggleGroupContext = React.createContext<{ size?: ToggleSize }>({})

function ToggleGroup({
  children,
  className,
  size = "default",
  ...props
}: Omit<ToggleGroupPrimitive.Props, "className"> & {
  className?: string
  size?: ToggleSize
}) {
  return (
    <ToggleGroupPrimitive
      className={cn("flex w-fit items-center", className)}
      data-slot="toggle-group"
      {...props}
    >
      <ToggleGroupContext.Provider value={{ size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  size = "default",
  ...props
}: Omit<TogglePrimitive.Props, "className"> & {
  className?: string
  size?: ToggleSize
}) {
  const context = React.useContext(ToggleGroupContext)
  return (
    <TogglePrimitive
      className={toggleClasses({
        className,
        size: context.size ?? size,
      })}
      data-slot="toggle-group-item"
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
