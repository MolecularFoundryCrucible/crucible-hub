import { useQuery, useSuspenseQuery } from "@tanstack/react-query"

import { ContentBoundary } from "@/components/crucible/content-layout"
import type { PersonIdentityProfile } from "@/components/crucible/person-identity"
import {
  useAdministrationScope,
  useWorkspacePrivilegeMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PersonProfileFields } from "@/components/crucible/person-profile-fields"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import {
  canOpenServiceAccountAdministration,
  canOpenUserAdministration,
} from "@/data/crucible/administration"
import { personQueryOptions } from "@/data/crucible/people.queries"
import { serviceAccountAdminQueryOptions } from "@/data/crucible/service-accounts.queries"
import { userDetailQueryOptions } from "@/data/crucible/users.queries"

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
  return (
    <ContentBoundary width="reading">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <PersonProfileFields
            hideMissing
            lastActiveAt={lastActiveAt}
            maxColumns={2}
            person={person}
            showOrcid
          />
        </CardContent>
      </Card>
    </ContentBoundary>
  )
}
