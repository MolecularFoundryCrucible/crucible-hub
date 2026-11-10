import { Link, Outlet, createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { AccountIcon } from "@/components/crucible/icons"
import {
  PersonAvatar,
  personDisplayName,
} from "@/components/crucible/person-identity"
import { PrincipalTypeIcon } from "@/components/crucible/resource-type-icon"
import { IdentityDetailPending } from "@/components/crucible/route-content-pending"
import {
  ResourceSectionNavigation,
  ResourceSectionPanel,
  resourceSectionActiveProps,
  resourceSectionLinkClassName,
} from "@/components/crucible/resource-section-navigation"
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
import { usePersonPage } from "@/features/people/person-page"
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
  const page = usePersonPage(userId)
  const {
    activePerson,
    administersPerson,
    adminUserResult,
    canAdminServiceAccounts,
    canAdminUsers,
    isSelf,
    isServiceAccount,
    person,
  } = page

  if (!activePerson) {
    if (canAdminUsers && adminUserResult.isPending) {
      return <IdentityDetailPending kind="person" />
    }
    return (
      <Card className="mx-auto mt-16 max-w-state">
        <CardHeader>
          <CardTitle>User not found</CardTitle>
          <CardDescription>
            This profile doesn't exist or you don't have access to it.
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
          <BreadcrumbItem>
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
        avatar={<PersonAvatar person={activePerson} size="lg" />}
        identifier={
          activePerson.username
            ? formatUsername(activePerson.username, "handle")
            : undefined
        }
        title={name}
      />

      {administersPerson ? (
        <ResourceSectionNavigation label="Person sections">
          <Link
            activeOptions={{ exact: true, includeSearch: false }}
            activeProps={resourceSectionActiveProps}
            className={resourceSectionLinkClassName}
            params={{ userId }}
            to="/users/$userId"
            viewTransition
          >
            Overview
          </Link>
          <Link
            activeOptions={{ includeSearch: false }}
            activeProps={resourceSectionActiveProps}
            className={resourceSectionLinkClassName}
            params={{ userId }}
            to="/users/$userId/security"
            viewTransition
          >
            Security
          </Link>
        </ResourceSectionNavigation>
      ) : null}

      <ResourceSectionPanel>
        <Outlet />
      </ResourceSectionPanel>
    </PageLayout>
  )
}
