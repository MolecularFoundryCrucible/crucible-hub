import { useQuery, useSuspenseQuery } from "@tanstack/react-query"

import { ActivityTime } from "@/components/crucible/activity-time"
import { ContentBoundary } from "@/components/crucible/content-layout"
import { MfidValue } from "@/components/crucible/mfid-value"
import { OrcidValue } from "@/components/crucible/orcid-value"
import type { PersonIdentityProfile } from "@/components/crucible/person-identity"
import {
  useAdministrationScope,
  useWorkspacePrivilegeMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import {
  canOpenServiceAccountAdministration,
  canOpenUserAdministration,
} from "@/data/crucible/administration"
import { personQueryOptions } from "@/data/crucible/people.queries"
import { serviceAccountAdminQueryOptions } from "@/data/crucible/service-accounts.queries"
import { userDetailQueryOptions } from "@/data/crucible/users.queries"
import { formatUsername } from "@/lib/username"

export function usePersonPage(userId: string) {
  const scope = useWorkspaceScope()
  const administrationScope = useAdministrationScope()
  const privilegeMode = useWorkspacePrivilegeMode()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const { data: person } = useSuspenseQuery(personQueryOptions(scope, userId))

  const canAdminUsers = canOpenUserAdministration(account, privilegeMode)
  const canAdminServiceAccounts = canOpenServiceAccountAdministration(
    account,
    privilegeMode
  )
  const isServiceAccount = Boolean(person?.is_service_account)
  const isSelf = account.unique_id === userId

  const adminUserResult = useQuery({
    ...userDetailQueryOptions(administrationScope, userId),
    enabled: canAdminUsers && !isServiceAccount,
  })
  const serviceAccountAdminResult = useQuery({
    ...serviceAccountAdminQueryOptions(administrationScope, userId),
    enabled: canAdminServiceAccounts && isServiceAccount,
  })

  const activePerson =
    adminUserResult.data ?? serviceAccountAdminResult.data ?? person
  const lastActiveAt =
    serviceAccountAdminResult.data !== undefined
      ? serviceAccountAdminResult.data?.last_active_at
      : adminUserResult.data !== undefined
        ? adminUserResult.data?.last_active_at
        : isSelf
          ? account.last_active_at
          : undefined
  const administersPerson = canAdminUsers && !isServiceAccount

  return {
    activePerson,
    administersPerson,
    administrationScope,
    adminUserResult,
    canAdminServiceAccounts,
    canAdminUsers,
    isSelf,
    isServiceAccount,
    lastActiveAt,
    person,
  }
}

export function ReadOnlyPersonProfileCard({
  lastActiveAt,
  person,
}: {
  lastActiveAt?: string | null
  person: PersonIdentityProfile
}) {
  const name = [person.first_name, person.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
  return (
    <ContentBoundary width="reading">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 @fields-wide:grid-cols-2">
            {name ? (
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-label text-muted-foreground">Name</dt>
                <dd className="text-body break-words">{name}</dd>
              </div>
            ) : null}
            {person.username ? (
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-label text-muted-foreground">Username</dt>
                <dd className="font-mono text-body break-words">
                  {formatUsername(person.username, "raw")}
                </dd>
              </div>
            ) : null}
            {lastActiveAt !== undefined ? (
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-label text-muted-foreground">
                  Last active
                </dt>
                <dd className="text-body">
                  <ActivityTime fallback="Never" value={lastActiveAt} />
                </dd>
              </div>
            ) : null}
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-label text-muted-foreground">Crucible ID</dt>
              <dd>
                <MfidValue value={person.unique_id} />
              </dd>
            </div>
            {person.orcid ? (
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-label text-muted-foreground">ORCID</dt>
                <dd>
                  <OrcidValue
                    orcid={person.orcid}
                    verified={person.orcid_verified}
                  />
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>
    </ContentBoundary>
  )
}
