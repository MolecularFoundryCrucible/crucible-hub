import { Link } from "@tanstack/react-router"

import { PersonIdentity } from "@/components/crucible/person-identity"
import type {
  PersonIdentityPresentation,
  PersonIdentityProfile,
  PersonIdentitySize,
  PersonNameStyle,
} from "@/components/crucible/person-identity"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"

export function PersonLink({
  className,
  nameStyle,
  person,
  presentation,
  size,
}: {
  className?: string
  nameStyle?: PersonNameStyle
  person: PersonIdentityProfile
  presentation?: PersonIdentityPresentation
  size?: PersonIdentitySize
}) {
  const link = (
    <Link
      className={cn(
        "group/person min-w-0",
        presentation === "inline" || presentation === undefined
          ? "inline-block"
          : "block",
        className
      )}
      params={{ personId: person.unique_id }}
      to="/people/$personId"
    >
      <PersonIdentity
        interactive
        nameStyle={nameStyle}
        person={person}
        presentation={presentation}
        size={size}
      />
    </Link>
  )

  return (
    <HoverCard>
      <HoverCardTrigger render={link} />
      <HoverCardContent>
        <PersonIdentity person={person} presentation="avatar" />
        <p className="mt-2 font-mono text-identifier break-all text-muted-foreground">
          {person.unique_id}
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}
