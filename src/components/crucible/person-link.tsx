import { Link } from "@tanstack/react-router"

import { IdentityHoverCard } from "@/components/crucible/identity-hover-card"
import {
  PersonIdentity,
  personDisplayName,
  personIsServiceAccount,
} from "@/components/crucible/person-identity"
import { MfidText } from "@/components/crucible/mfid-text"
import type {
  PersonIdentityPresentation,
  PersonIdentityProfile,
  PersonIdentitySize,
  PersonNameStyle,
} from "@/components/crucible/person-identity"
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
  const label = personDisplayName(person, nameStyle)
  const link = (
    <Link
      aria-label={
        personIsServiceAccount(person) ? `${label}, Service account` : label
      }
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
    <IdentityHoverCard trigger={link}>
      <PersonIdentity person={person} presentation="avatar" />
      <MfidText
        className="mt-2 block whitespace-nowrap text-muted-foreground"
        value={person.unique_id}
      />
    </IdentityHoverCard>
  )
}
