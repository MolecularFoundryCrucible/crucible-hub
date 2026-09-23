import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, Navigate, createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { IdentityDetailPending } from "@/components/crucible/route-content-pending"
import {
  useAdministrationScope,
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { canOpenServiceAccountAdministration } from "@/data/crucible/administration"
import {
  crucibleKeys,
  identityScopeWithPrivilegeMode,
} from "@/data/crucible/query-keys"
import { serviceAccountAdminQueryOptions } from "@/data/crucible/service-accounts.queries"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"
import { ServiceAccountDetail } from "@/features/service-accounts/service-account-detail"
import { hubPageTitle } from "@/lib/page-title"
import { formatUsername } from "@/lib/username"

export const Route = createFileRoute(
  "/_app/admin/service-accounts/$serviceAccountMfid"
)({
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const account = context.queryClient.getQueryData<WorkspaceAccount>(
      crucibleKeys.accountProfile(source.scope)
    )
    if (!account || !canOpenServiceAccountAdministration(account)) return
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

function ServiceAccountAdminPage() {
  const { serviceAccountMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const administrationScope = useAdministrationScope()
  const mode = useWorkspaceMode()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const serviceAccountResult = useQuery({
    ...serviceAccountAdminQueryOptions(administrationScope, serviceAccountMfid),
    enabled: canOpenServiceAccountAdministration(account),
  })

  if (!canOpenServiceAccountAdministration(account)) {
    return <Navigate replace to="/" />
  }

  if (serviceAccountResult.isPending) {
    return <IdentityDetailPending kind="service_account" />
  }

  if (serviceAccountResult.isError) {
    return (
      <Card className="mx-auto mt-16 max-w-state">
        <CardHeader>
          <CardTitle>Service account could not be loaded</CardTitle>
          <CardDescription>Try opening this account again.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!serviceAccountResult.data) {
    return (
      <Card className="mx-auto mt-16 max-w-state">
        <CardHeader>
          <CardTitle>Service account not found</CardTitle>
          <CardDescription>
            This service account is not available in the current workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const serviceAccount = serviceAccountResult.data

  const title =
    formatUsername(serviceAccount.username, "raw") || serviceAccount.unique_id

  return (
    <PageLayout>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/admin/service-accounts" />}>
              Service accounts
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0 flex-1 shrink">
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        icon={
          <PrincipalTypeIcon className="mt-1 size-6" type="service_account" />
        }
        title={title}
      />
      <ServiceAccountDetail
        account={serviceAccount}
        canChangePlatformRole={!account.is_service_account}
        mode={mode}
        scope={administrationScope}
      />
    </PageLayout>
  )
}
