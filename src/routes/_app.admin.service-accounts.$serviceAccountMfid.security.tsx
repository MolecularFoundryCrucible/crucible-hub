import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { personDisplayName } from "@/components/crucible/person-identity"
import { useAdministrationScope } from "@/components/crucible/workspace-provider"
import { serviceAccountAdminQueryOptions } from "@/data/crucible/service-accounts.queries"
import { ServiceAccountSecurityCard } from "@/features/account-profile/security-card"
import { RotateServiceAccountKeyAction } from "@/features/service-accounts/service-account-detail"

export const Route = createFileRoute(
  "/_app/admin/service-accounts/$serviceAccountMfid/security"
)({
  component: ServiceAccountSecurityPage,
})

function ServiceAccountSecurityPage() {
  const { serviceAccountMfid } = Route.useParams()
  const administrationScope = useAdministrationScope()
  const { data: serviceAccount } = useSuspenseQuery(
    serviceAccountAdminQueryOptions(administrationScope, serviceAccountMfid)
  )
  if (!serviceAccount) return null
  return (
    <ServiceAccountSecurityCard
      name={personDisplayName(serviceAccount)}
      rotateAction={
        <RotateServiceAccountKeyAction
          account={serviceAccount}
          scope={administrationScope}
        />
      }
      scope={administrationScope}
      userId={serviceAccount.unique_id}
    />
  )
}
