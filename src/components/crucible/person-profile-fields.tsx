import { ActivityTime } from "@/components/crucible/activity-time"
import { EmailValue } from "@/components/crucible/email-value"
import { MfidValue } from "@/components/crucible/mfid-value"
import { OrcidValue } from "@/components/crucible/orcid-value"
import type { PersonIdentityProfile } from "@/components/crucible/person-identity"
import { PlatformRoleBadge } from "@/components/crucible/platform-role-badge"
import { formatUsername } from "@/lib/username"
import { cn } from "@/lib/utils"

type PlatformRole = React.ComponentProps<typeof PlatformRoleBadge>["role"]

function ProfileField({
  children,
  className,
  label,
}: {
  children: React.ReactNode
  className?: string
  label: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-body break-words">{children}</dd>
    </div>
  )
}

function NotProvided() {
  return <span className="text-muted-foreground">Not provided</span>
}

// An undefined prop hides its row; null shows the row as not provided.
export function PersonProfileFields({
  email,
  hideMissing = false,
  lastActiveAt,
  maxColumns = 3,
  person,
  platformRole,
  showOrcid = false,
}: {
  email?: string | null
  hideMissing?: boolean
  lastActiveAt?: string | null
  maxColumns?: 2 | 3
  person: PersonIdentityProfile
  platformRole?: PlatformRole | null
  showOrcid?: boolean
}) {
  const name = [person.first_name, person.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
  const username = formatUsername(person.username, "raw")

  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-4 @md:grid-cols-2",
        maxColumns === 3 && "@3xl:grid-cols-3"
      )}
    >
      {name || !hideMissing ? (
        <ProfileField className="@md:col-span-2 @3xl:col-span-1" label="Name">
          {name || <NotProvided />}
        </ProfileField>
      ) : null}
      {username || !hideMissing ? (
        <ProfileField label="Username">
          {username ? (
            <span className="font-mono">{username}</span>
          ) : (
            <NotProvided />
          )}
        </ProfileField>
      ) : null}
      {email !== undefined ? (
        <ProfileField label="Email">
          {email ? <EmailValue email={email} /> : <NotProvided />}
        </ProfileField>
      ) : null}
      {platformRole !== undefined ? (
        <ProfileField label="Platform role">
          {platformRole ? (
            <PlatformRoleBadge role={platformRole} />
          ) : (
            <span className="text-muted-foreground">No platform role</span>
          )}
        </ProfileField>
      ) : null}
      {lastActiveAt !== undefined ? (
        <ProfileField label="Last active">
          <ActivityTime fallback="Never" value={lastActiveAt} />
        </ProfileField>
      ) : null}
      <ProfileField label="Crucible ID">
        <MfidValue value={person.unique_id} />
      </ProfileField>
      {showOrcid && person.orcid ? (
        <ProfileField label="ORCID">
          <OrcidValue orcid={person.orcid} verified={person.orcid_verified} />
        </ProfileField>
      ) : null}
    </dl>
  )
}
