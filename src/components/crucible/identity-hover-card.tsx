import type { ReactElement, ReactNode } from "react"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

export function IdentityHoverCard({
  children,
  trigger,
}: {
  children: ReactNode
  trigger: ReactElement
}) {
  return (
    <HoverCard>
      <HoverCardTrigger render={trigger} />
      <HoverCardContent className="w-(--spacing-identity-preview)">
        {children}
      </HoverCardContent>
    </HoverCard>
  )
}
