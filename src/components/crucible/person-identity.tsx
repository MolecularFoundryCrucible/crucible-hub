import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type PersonIdentityPresentation = "avatar" | "inline" | "stacked"
type PersonNameStyle = "abbreviated" | "full"
type PersonIdentitySize = "default" | "lg" | "sm"
const mfidPattern = /^[0-9A-HJKMNP-TV-Z]{26}$/i

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
  presentation?: PersonIdentityPresentation
  size?: PersonIdentitySize
}) {
  const name = personDisplayName(person, nameStyle)
  const username = normalizedUsername(person.username ?? person.context)
  const isServiceAccount =
    person.is_service_account ?? mfidPattern.test(person.unique_id)
  const secondary = [
    username,
    isServiceAccount ? "Service account" : null,
  ]
    .filter(Boolean)
    .join(" · ")

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
      <span className="truncate text-supporting text-muted-foreground">
        {secondary || "No username"}
      </span>
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
      <Avatar size={size}>
        <AvatarFallback
          className={cn(
            "ring-2",
            isServiceAccount
              ? "bg-muted text-foreground ring-(--resource-service-account)"
              : "bg-muted text-foreground ring-(--resource-person)"
          )}
          data-account-type={
            isServiceAccount ? "service-account" : "person"
          }
        >
          {personInitials(person)}
        </AvatarFallback>
      </Avatar>
      {details}
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
