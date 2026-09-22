import { MfidText } from "@/components/crucible/mfid-text"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type PersonIdentityPresentation = "avatar" | "inline" | "stacked"
type PersonIdentityVariant = PersonIdentityPresentation | "tooltip"
type PersonNameStyle = "abbreviated" | "full"
type PersonIdentitySize = "default" | "lg" | "sm"

export type PersonIdentityProfile = {
  context?: string | null
  first_name?: string | null
  is_service_account?: boolean | null
  last_name?: string | null
  name?: string | null
  unique_id: string
  username?: string | null
}

export function personDisplayName(
  person: PersonIdentityProfile,
  style: PersonNameStyle = "full"
) {
  const firstName = person.first_name?.trim() ?? ""
  const lastName = person.last_name?.trim() ?? ""
  if (style === "abbreviated" && firstName && lastName) {
    return `${firstName.charAt(0)}. ${lastName}`
  }
  const structuredName = [firstName, lastName].filter(Boolean).join(" ")
  return (
    structuredName ||
    person.name?.trim() ||
    normalizedUsername(person.username ?? person.context) ||
    person.unique_id
  )
}

export function personIsServiceAccount(person: PersonIdentityProfile) {
  return person.is_service_account === true
}

export function PersonIdentity({
  className,
  detailsClassName,
  interactive = false,
  nameStyle = "full",
  person,
  presentation = "inline",
  size = "default",
}: {
  className?: string
  detailsClassName?: string
  interactive?: boolean
  nameStyle?: PersonNameStyle
  person: PersonIdentityProfile
  presentation?: PersonIdentityVariant
  size?: PersonIdentitySize
}) {
  const name = personDisplayName(person, nameStyle)
  const username = normalizedUsername(person.username ?? person.context)
  const isServiceAccount = personIsServiceAccount(person)

  if (presentation === "inline") {
    return (
      <span
        className={cn(
          "text-label break-words",
          interactive && "group-hover/person:underline",
          className
        )}
      >
        {name}
      </span>
    )
  }

  const avatar = (
    <Avatar size={size}>
      <AvatarFallback
        className={cn(
          "ring-2",
          isServiceAccount
            ? "bg-muted text-foreground ring-(--resource-service-account)"
            : "bg-muted text-foreground ring-(--resource-person)"
        )}
        data-account-type={isServiceAccount ? "service-account" : "person"}
      >
        {personInitials(person)}
      </AvatarFallback>
    </Avatar>
  )

  if (presentation === "tooltip") {
    return (
      <span className={cn("flex min-w-0 items-start gap-3", className)}>
        {avatar}
        <span className="grid min-w-0 text-left">
          <span className="truncate text-label">{name}</span>
          <PersonSecondaryLine
            isServiceAccount={isServiceAccount}
            username={username}
          />
          <MfidText
            className="mt-1 block whitespace-nowrap text-muted-foreground"
            presentation="supporting"
            value={person.unique_id}
          />
        </span>
      </span>
    )
  }

  const details = (
    <span className={cn("grid min-w-0 text-left", detailsClassName)}>
      <span
        className={cn(
          "truncate",
          size === "lg" ? "text-title-section" : "text-label",
          interactive && "group-hover/person:underline"
        )}
      >
        {name}
      </span>
      <PersonSecondaryLine
        hideUsername={
          !isServiceAccount && name === username && Boolean(username)
        }
        isServiceAccount={isServiceAccount}
        username={username}
      />
    </span>
  )

  if (presentation === "stacked") {
    return <span className={cn("block min-w-0", className)}>{details}</span>
  }

  return (
    <span
      className={cn(
        "flex min-w-0 items-center",
        size === "sm" ? "gap-2" : "gap-3",
        className
      )}
    >
      {avatar}
      {details}
    </span>
  )
}

function PersonSecondaryLine({
  hideUsername = false,
  isServiceAccount,
  username,
}: {
  hideUsername?: boolean
  isServiceAccount: boolean
  username: string
}) {
  const showUsername = !hideUsername
  return (
    <span className="flex min-w-0 items-center gap-1 text-supporting text-muted-foreground">
      {showUsername ? (
        <>
          <span className="truncate">{username || "No username"}</span>
          <span aria-hidden="true">·</span>
        </>
      ) : null}
      <PrincipalTypeIcon
        className="size-3.5"
        label={isServiceAccount ? "Service account" : "Person"}
        type={isServiceAccount ? "service_account" : "user"}
      />
    </span>
  )
}

function normalizedUsername(username: string | null | undefined) {
  const value = username?.trim().replace(/^@/, "")
  return value ? `@${value}` : ""
}

function personInitials(person: PersonIdentityProfile) {
  const firstName = person.first_name?.trim()
  const lastName = person.last_name?.trim()
  if (firstName || lastName) {
    return `${firstName?.charAt(0) ?? ""}${lastName?.charAt(0) ?? ""}`.toUpperCase()
  }
  const words = personDisplayName(person).split(/\s+/)
  return `${words.at(0)?.charAt(0) ?? ""}${words.at(-1)?.charAt(0) ?? ""}`.toUpperCase()
}

export type { PersonIdentityPresentation, PersonIdentitySize, PersonNameStyle }
