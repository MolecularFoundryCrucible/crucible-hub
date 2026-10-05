import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, Navigate, createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { PersonIcon } from "@/components/crucible/icons"
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
import { canOpenUserAdministration } from "@/data/crucible/administration"
import {
  crucibleKeys,
  identityScopeWithPrivilegeMode,
} from "@/data/crucible/query-keys"
import { userDetailQueryOptions } from "@/data/crucible/users.queries"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"
import { UserDetailView } from "@/features/admin/user-detail"
import { hubPageTitle } from "@/lib/page-title"

export const Route = createFileRoute("/_app/admin/users/$userMfid")({
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const account = context.queryClient.getQueryData<WorkspaceAccount>(
      crucibleKeys.accountProfile(source.scope)
    )
    if (!account || !canOpenUserAdministration(account)) return
    const administrationScope = identityScopeWithPrivilegeMode(
      source.scope,
      "elevated"
    )
    const user = await context.queryClient.ensureQueryData(
      userDetailQueryOptions(administrationScope, params.userMfid)
    )
    return { username: user?.username }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: hubPageTitle(loaderData?.username) }],
  }),
  pendingComponent: () => <IdentityDetailPending kind="person" />,
  component: UserAdminDetailPage,
})

function UserAdminDetailPage() {
  const { userMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const administrationScope = useAdministrationScope()
  const mode = useWorkspaceMode()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const userResult = useQuery({
    ...userDetailQueryOptions(administrationScope, userMfid),
    enabled: canOpenUserAdministration(account),
  })

  if (!canOpenUserAdministration(account)) {
    return <Navigate replace to="/" />
  }

  if (userResult.isPending) {
    return <IdentityDetailPending kind="person" />
  }

  if (userResult.isError) {
    return (
      <Card className="mx-auto mt-16 max-w-state">
        <CardHeader>
          <CardTitle>User could not be loaded</CardTitle>
          <CardDescription>Try opening this user again.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!userResult.data) {
    return (
      <Card className="mx-auto mt-16 max-w-state">
        <CardHeader>
          <CardTitle>User not found</CardTitle>
          <CardDescription>
            The user might have been removed or does not exist.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const user = userResult.data
  const displayName =
    `${user.first_name} ${user.last_name}`.trim() || user.username || userMfid

  return (
    <PageLayout>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/admin" />}>
              Administration
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/admin/users" />}>
              Users
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{displayName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        icon={<PersonIcon aria-hidden="true" />}
        title={displayName}
      />
      <UserDetailView mode={mode} scope={administrationScope} user={user} />
    </PageLayout>
  )
}
