import type { ReactNode } from "react"

export function ResourceName({ children }: { children: ReactNode }) {
  return <strong className="break-words">{children}</strong>
}
