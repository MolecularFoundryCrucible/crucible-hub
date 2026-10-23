import type { ComponentProps } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** A monospaced field for MFIDs, ORCIDs, and API keys, typed or copied exactly. */
export function IdentifierInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      autoCapitalize="none"
      autoComplete="off"
      autoCorrect="off"
      className={cn("font-mono", className)}
      spellCheck={false}
      {...props}
    />
  )
}
