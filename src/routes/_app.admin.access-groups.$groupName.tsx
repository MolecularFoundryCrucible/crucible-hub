import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, Navigate, createFileRoute } from "@tanstack/react-router"

import {
  OpenFullPageIcon,
  PersonIcon,
  UserGroupIcon,
} from "@/components/crucible/icons"
import { MfidText } from "@/components/crucible/mfid-text"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { PersonIdentity } from "@/components/crucible/person-identity"
import {
  useAdministrationScope,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  accessGroupDetailQueryOptions,
  accessGroupUsersQueryOptions,
} from "@/data/crucible/access-groups.queries"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { canOpenAccessGroupAdministration } from "@/data/crucible/administration"
import {
  crucibleKeys,
  identityScopeWithPrivilegeMode,
} from "@/data/crucible/query-keys"
import type { WorkspaceAccount } from "@/data/crucible/workspace-source"
import { hubPageTitle } from "@/lib/page-title"
import { formatUsername } from "@/lib/username"

export const Route = createFileRoute("/_app/admin/access-groups/$groupName")({
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const account = context.queryClient.getQueryData<WorkspaceAccount>(
      crucibleKeys.accountProfile(source.scope)
    )
    if (!account || !canOpenAccessGroupAdministration(account)) return
    const administrationScope = identityScopeWithPrivilegeMode(
      source.scope,
      "elevated"
    )
    await context.queryClient.ensureQueryData(
      accessGroupDetailQueryOptions(administrationScope, params.groupName)
    )
    await context.queryClient.ensureQueryData(
      accessGroupUsersQueryOptions(administrationScope, params.groupName)
    )
  },
  head: ({ params }) => ({
    meta: [{ title: hubPageTitle(params.groupName) }],
  }),
  component: AccessGroupDetailPage,
})

function AccessGroupDetailPage() {
  const { groupName } = Route.useParams()
  const scope = useWorkspaceScope()
  const administrationScope = useAdministrationScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))

  const groupQuery = useQuery({
    ...accessGroupDetailQueryOptions(administrationScope, groupName),
    enabled: canOpenAccessGroupAdministration(account),
  })
  const usersQuery = useQuery({
    ...accessGroupUsersQueryOptions(administrationScope, groupName),
    enabled: canOpenAccessGroupAdministration(account),
  })

  if (!canOpenAccessGroupAdministration(account)) {
    return <Navigate replace to="/" />
  }

  const group = groupQuery.data
  const members = usersQuery.data ?? []

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
            <BreadcrumbLink render={<Link to="/admin/access-groups" />}>
              Access groups
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{groupName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        icon={<UserGroupIcon aria-hidden="true" />}
        title={groupName}
      />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Group details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-label text-muted-foreground">Group name</dt>
                <dd className="mt-1 font-mono text-body">{groupName}</dd>
              </div>
              <div>
                <dt className="text-label text-muted-foreground">ID</dt>
                <dd className="mt-1 font-mono text-body">{group?.id ?? "-"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card aria-busy={usersQuery.isPending}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PersonIcon aria-hidden="true" />
              Members ({members.length})
            </CardTitle>
            <CardDescription>
              Users assigned to this access group.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {members.length > 0 ? (
              <Table aria-label={`Members of ${groupName}`}>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Crucible ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-center">
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.unique_id}>
                      <TableCell>
                        <PersonIdentity
                          person={member}
                          presentation="avatar"
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        <MfidText value={member.unique_id} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.role === "admin" ? "default" : "secondary"
                          }
                        >
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link
                          aria-label={`Open user ${formatUsername(member.username, "raw")}`}
                          className={buttonVariants({
                            size: "table-action",
                            variant: "ghost",
                          })}
                          params={{ userMfid: member.unique_id }}
                          to="/admin/users/$userMfid"
                        >
                          <OpenFullPageIcon aria-hidden="true" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty className="min-h-state border-none">
                <EmptyHeader>
                  <EmptyTitle>No members</EmptyTitle>
                  <EmptyDescription>
                    This access group currently has no members assigned.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
