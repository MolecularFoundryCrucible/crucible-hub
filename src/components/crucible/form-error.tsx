import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function FormErrorRegion({
  children,
  padded = false,
}: {
  children?: ReactNode
  padded?: boolean
}) {
  return (
    <div
      className={cn(
        "flex min-h-5 flex-col gap-2 text-body text-destructive",
        padded && "pt-5"
      )}
      role="alert"
    >
      {children}
    </div>
  )
}

export function SaveError({
  message,
  padded = false,
}: {
  message?: ReactNode
  padded?: boolean
}) {
  return (
    <FormErrorRegion padded={padded}>
      {message ? <p>{message}</p> : null}
    </FormErrorRegion>
  )
}
