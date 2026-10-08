import { Link } from "@tanstack/react-router"

import { IdentityHoverCard } from "@/components/crucible/identity-hover-card"
import {
  PersonIdentity,
  personDisplayName,
  personIsServiceAccount,
} from "@/components/crucible/person-identity"
import type {
  PersonIdentityPresentation,
  PersonIdentityProfile,
  PersonIdentitySize,
  PersonNameStyle,
} from "@/components/crucible/person-identity"
import { SelectableTextLink } from "@/components/crucible/selectable-text-link"

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
  const isCollection = presentation === "collection"
  const nameLink = (
    <SelectableTextLink
      aria-label={
        personIsServiceAccount(person) ? `${label}, Service account` : label
      }
      className={isCollection ? "block truncate" : "inline-block"}
      render={
        <Link params={{ userId: person.unique_id }} to="/users/$userId" />
      }
    >
      {label}
    </SelectableTextLink>
  )

  return (
    <PersonIdentity
      className={className}
      nameContent={
        <IdentityHoverCard trigger={nameLink}>
          <PersonIdentity person={person} presentation="tooltip" />
        </IdentityHoverCard>
      }
      nameStyle={nameStyle}
      person={person}
      presentation={presentation}
      size={size}
    />
  )
}
