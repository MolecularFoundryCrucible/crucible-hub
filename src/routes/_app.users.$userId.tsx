import { createFileRoute } from "@tanstack/react-router"
import { personDisplayName } from "@/components/crucible/person-identity"
import { IdentityDetailPending } from "@/components/crucible/route-content-pending"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import {
  canOpenServiceAccountAdministration,
  canOpenUserAdministration,
} from "@/data/crucible/administration"
import { identityScopeWithPrivilegeMode } from "@/data/crucible/query-keys"
import { personQueryOptions } from "@/data/crucible/people.queries"
import { serviceAccountAdminQueryOptions } from "@/data/crucible/service-accounts.queries"
import { userDetailQueryOptions } from "@/data/crucible/users.queries"
import type { WorkspaceAdminUser } from "@/data/crucible/workspace-source"
import { hubPageTitle } from "@/lib/page-title"
import { UserPage } from "@/features/people/user-layout"

export const Route = createFileRoute("/_app/users/$userId")({
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const account = await context.queryClient.ensureQueryData(
      accountQueryOptions(source.scope)
    )
    const canAdminUsers = canOpenUserAdministration(
      account,
      source.privilegeMode
    )
    const canAdminServiceAccounts = canOpenServiceAccountAdministration(
      account,
      source.privilegeMode
    )
    const administrationScope = identityScopeWithPrivilegeMode(
      source.scope,
      "elevated"
    )
    const [person, detail] = await Promise.all([
      context.queryClient.ensureQueryData(
        personQueryOptions(source.scope, params.userId)
      ),
      canAdminUsers
        ? context.queryClient.ensureQueryData(
            userDetailQueryOptions(administrationScope, params.userId)
          )
        : undefined,
    ])
    let adminUser: WorkspaceAdminUser | null | undefined
    if (canAdminUsers && !person?.is_service_account) {
      adminUser = detail
    } else if (canAdminServiceAccounts && person?.is_service_account) {
      await context.queryClient.ensureQueryData(
        serviceAccountAdminQueryOptions(administrationScope, params.userId)
      )
    }
    const name = person
      ? personDisplayName(person)
      : adminUser
        ? personDisplayName(adminUser)
        : undefined
    return {
      personName: name,
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: hubPageTitle(loaderData?.personName) }],
  }),
  pendingComponent: () => <IdentityDetailPending kind="person" />,
  component: UserPage,
})
