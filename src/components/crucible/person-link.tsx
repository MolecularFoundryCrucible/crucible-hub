import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

export function PersonLink({
  children,
  name,
  personId,
  username,
}: {
  children?: ReactNode
  name: string
  personId: string
  username?: string | null
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Link
            className="text-label break-words hover:underline"
            params={{ personId }}
            to="/people/$personId"
          />
        }
      >
        {children ?? name}
      </HoverCardTrigger>
      <HoverCardContent>
        <p className="text-label break-words">{name}</p>
        <p className="text-supporting break-words text-muted-foreground">
          {username ? `@${username}` : "No username"}
        </p>
        <p className="mt-2 font-mono text-identifier break-all text-muted-foreground">
          {personId}
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}
