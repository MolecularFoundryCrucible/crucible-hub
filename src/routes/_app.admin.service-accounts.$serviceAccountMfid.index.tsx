import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ContentBoundary } from "@/components/crucible/content-layout"
import {
  useAdministrationScope,
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { serviceAccountAdminQueryOptions } from "@/data/crucible/service-accounts.queries"
import { ServiceAccountProfileCard } from "@/features/service-accounts/service-account-detail"

export const Route = createFileRoute(
  "/_app/admin/service-accounts/$serviceAccountMfid/"
)({
  component: ServiceAccountOverviewPage,
})

function ServiceAccountOverviewPage() {
  const { serviceAccountMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const administrationScope = useAdministrationScope()
  const mode = useWorkspaceMode()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const { data: serviceAccount } = useSuspenseQuery(
    serviceAccountAdminQueryOptions(administrationScope, serviceAccountMfid)
  )
  if (!serviceAccount) return null
  return (
    <ContentBoundary width="reading">
      <ServiceAccountProfileCard
        key={serviceAccount.unique_id}
        account={serviceAccount}
        canChangePlatformRole={!account.is_service_account}
        mode={mode}
        scope={administrationScope}
      />
    </ContentBoundary>
  )
}
