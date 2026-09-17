import type { ReactNode } from "react"

import { BreakableText } from "@/components/crucible/breakable-text"

export function ResourceName({ children }: { children: ReactNode }) {
  return (
    <strong className="break-words">
      {typeof children === "string" ? (
        <BreakableText value={children} />
      ) : (
        children
      )}
    </strong>
  )
}
