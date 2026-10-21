import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

import { ActivityTime } from "@/components/crucible/activity-time"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { MfidValue } from "@/components/crucible/mfid-value"
import { AccountIcon } from "@/components/crucible/icons"
import {
  PersonIdentity,
  personDisplayName,
} from "@/components/crucible/person-identity"
import type { PersonIdentityProfile } from "@/components/crucible/person-identity"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { ContentBoundary } from "@/components/crucible/content-layout"
import {
  IdentityDetailContentPending,
  IdentityDetailPending,
} from "@/components/crucible/route-content-pending"
import {
  useAdministrationScope,
  useWorkspacePrivilegeMode,
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
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
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
import { UserDetailView } from "@/features/admin/user-detail"
import { hubPageTitle } from "@/lib/page-title"
import { formatUsername } from "@/lib/username"

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

function UserPage() {
  const { userId } = Route.useParams()
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

  if (!activePerson) {
    if (canAdminUsers && adminUserResult.isPending) {
      return <IdentityDetailPending kind="person" />
    }
    return (
      <Card className="mx-auto mt-16 max-w-state">
        <CardHeader>
          <CardTitle>User not found</CardTitle>
          <CardDescription>
            This profile is not available in the current workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const name = personDisplayName(activePerson)

  return (
    <PageLayout>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            {isServiceAccount ? (
              canAdminServiceAccounts ? (
                <BreadcrumbLink render={<Link to="/admin/service-accounts" />}>
                  Service accounts
                </BreadcrumbLink>
              ) : (
                <BreadcrumbLink
                  render={<Link search={{ kind: "person" }} to="/search" />}
                >
                  Users
                </BreadcrumbLink>
              )
            ) : canAdminUsers ? (
              <BreadcrumbLink render={<Link to="/admin/users" />}>
                Users
              </BreadcrumbLink>
            ) : (
              <BreadcrumbLink
                render={<Link search={{ kind: "person" }} to="/search" />}
              >
                Users
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0 flex-1 shrink">
            <BreadcrumbPage>{name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        actions={
          isServiceAccount && canAdminServiceAccounts && person ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ serviceAccountMfid: person.unique_id }}
              preload={false}
              to="/admin/service-accounts/$serviceAccountMfid"
            >
              <PrincipalTypeIcon
                data-icon="inline-start"
                type="service_account"
              />
              Manage service account
            </Link>
          ) : isSelf ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              to="/account"
            >
              <AccountIcon aria-hidden="true" data-icon="inline-start" />
              Manage account
            </Link>
          ) : null
        }
        icon={
          <PrincipalTypeIcon
            className="size-5"
            type={isServiceAccount ? "service_account" : "user"}
          />
        }
        title={name}
      />

      {canAdminUsers && !isServiceAccount ? (
        adminUserResult.isPending ? (
          <IdentityDetailContentPending kind="person" />
        ) : adminUserResult.data ? (
          <UserDetailView
            key={adminUserResult.data.unique_id}
            scope={administrationScope}
            user={adminUserResult.data}
          />
        ) : (
          <ReadOnlyPersonProfileCard
            lastActiveAt={lastActiveAt}
            person={activePerson}
          />
        )
      ) : (
        <ReadOnlyPersonProfileCard
          lastActiveAt={lastActiveAt}
          person={activePerson}
        />
      )}
    </PageLayout>
  )
}

function ReadOnlyPersonProfileCard({
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
          <PersonIdentity person={person} presentation="avatar" size="lg" />
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-label text-muted-foreground">Username</dt>
              <dd className="text-body break-words">
                {person.username ? (
                  <span className="font-mono">
                    {formatUsername(person.username, "raw")}
                  </span>
                ) : (
                  "Not provided"
                )}
              </dd>
            </div>
            <div className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
              <dt className="text-label text-muted-foreground">Crucible ID</dt>
              <dd>
                <MfidValue value={person.unique_id} />
              </dd>
            </div>
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
          </dl>
        </CardContent>
      </Card>
    </ContentBoundary>
  )
}
