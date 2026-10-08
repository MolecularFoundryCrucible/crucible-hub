import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"

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
import { userDetailQueryOptions } from "@/data/crucible/users.queries"
import type { WorkspaceAdminUser } from "@/data/crucible/workspace-source"
import { UserDetailView } from "@/features/admin/user-detail"
import { hubPageTitle } from "@/lib/page-title"

export const Route = createFileRoute("/_app/users/$userId")({
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const person = await context.queryClient.ensureQueryData(
      personQueryOptions(source.scope, params.userId)
    )
    const account = await context.queryClient.ensureQueryData(
      accountQueryOptions(source.scope)
    )
    let adminUser: WorkspaceAdminUser | null | undefined
    if (canOpenUserAdministration(account) && !person?.is_service_account) {
      const administrationScope = identityScopeWithPrivilegeMode(
        source.scope,
        "elevated"
      )
      adminUser = await context.queryClient.ensureQueryData(
        userDetailQueryOptions(administrationScope, params.userId)
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
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const { data: person } = useSuspenseQuery(personQueryOptions(scope, userId))

  const canAdminUsers = canOpenUserAdministration(account)
  const isServiceAccount = Boolean(person?.is_service_account)
  const isSelf = account.unique_id === userId

  const adminUserResult = useQuery({
    ...userDetailQueryOptions(administrationScope, userId),
    enabled: canAdminUsers && !isServiceAccount,
  })

  const activePerson = adminUserResult.data ?? person

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
              canOpenServiceAccountAdministration(account) ? (
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
          isServiceAccount &&
          canOpenServiceAccountAdministration(account) &&
          person ? (
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
              <AccountIcon data-icon="inline-start" />
              Manage account
            </Link>
          ) : null
        }
        icon={
          <PrincipalTypeIcon
            className="mt-1 size-6 shrink-0"
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
          <ReadOnlyPersonProfileCard person={activePerson} />
        )
      ) : (
        <ReadOnlyPersonProfileCard person={activePerson} />
      )}
    </PageLayout>
  )
}

function ReadOnlyPersonProfileCard({
  person,
}: {
  person: PersonIdentityProfile
}) {
  return (
    <ContentBoundary width="reading">
      <Card>
        <CardHeader>
          <PersonIdentity person={person} presentation="avatar" size="lg" />
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-label text-muted-foreground">Username</dt>
              <dd className="text-body">{person.username ?? "Not provided"}</dd>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <dt className="text-label text-muted-foreground">Crucible ID</dt>
              <dd>
                <MfidValue value={person.unique_id} />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </ContentBoundary>
  )
}
