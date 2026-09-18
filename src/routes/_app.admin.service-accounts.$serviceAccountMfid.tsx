import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, Navigate, createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { RouteContentPending } from "@/components/crucible/route-content-pending"
import {
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
import { crucibleKeys } from "@/data/crucible/query-keys"
import { serviceAccountAdminQueryOptions } from "@/data/crucible/service-accounts.queries"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"
import { ServiceAccountDetail } from "@/features/service-accounts/service-account-detail"
import { hubPageTitle } from "@/lib/page-title"

export const Route = createFileRoute(
  "/_app/admin/service-accounts/$serviceAccountMfid"
)({
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const account = context.queryClient.getQueryData<WorkspaceAccount>(
      crucibleKeys.accountProfile(source.scope)
    )
    if (!account?.capabilities.can_manage_service_accounts) return
    const serviceAccount = await context.queryClient.ensureQueryData(
      serviceAccountAdminQueryOptions(source.scope, params.serviceAccountMfid)
    )
    return { username: serviceAccount?.username }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: hubPageTitle(loaderData?.username) }],
  }),
  pendingComponent: RouteContentPending,
  component: ServiceAccountAdminPage,
})

function ServiceAccountAdminPage() {
  const { serviceAccountMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const mode = useWorkspaceMode()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const serviceAccountResult = useQuery({
    ...serviceAccountAdminQueryOptions(scope, serviceAccountMfid),
    enabled: account.capabilities.can_manage_service_accounts,
  })

  if (!account.capabilities.can_manage_service_accounts) {
    return <Navigate replace to="/" />
  }

  if (serviceAccountResult.isPending) return <RouteContentPending />

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

  const title = serviceAccount.username
    ? `@${serviceAccount.username}`
    : serviceAccount.unique_id

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
          <BreadcrumbItem>
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
        scope={scope}
      />
    </PageLayout>
  )
}
