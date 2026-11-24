import { createFileRoute } from "@tanstack/react-router"
import { IdentityDetailPending } from "@/components/crucible/route-content-pending"
import { canOpenServiceAccountAdministration } from "@/data/crucible/administration"
import {
  crucibleKeys,
  identityScopeWithPrivilegeMode,
} from "@/data/crucible/query-keys"
import { serviceAccountAdminQueryOptions } from "@/data/crucible/service-accounts.queries"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"
import { hubPageTitle } from "@/lib/page-title"
import { ServiceAccountAdminPage } from "@/features/service-accounts/service-account-layout"

export const Route = createFileRoute(
  "/_app/admin/service-accounts/$serviceAccountMfid"
)({
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const account = context.queryClient.getQueryData<WorkspaceAccount>(
      crucibleKeys.accountProfile(source.scope)
    )
    if (
      !account ||
      !canOpenServiceAccountAdministration(account, source.privilegeMode)
    )
      return
    const administrationScope = identityScopeWithPrivilegeMode(
      source.scope,
      "elevated"
    )
    const serviceAccount = await context.queryClient.ensureQueryData(
      serviceAccountAdminQueryOptions(
        administrationScope,
        params.serviceAccountMfid
      )
    )
    return { username: serviceAccount?.username }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: hubPageTitle(loaderData?.username) }],
  }),
  pendingComponent: () => <IdentityDetailPending kind="service_account" />,
  component: ServiceAccountAdminPage,
})
