import { Link, Outlet, getRouteApi } from "@tanstack/react-router"
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
import { usePersonPage } from "@/features/people/person-page"
import { formatUsername } from "@/lib/username"

const route = getRouteApi("/_app/users/$userId")

export function UserPage() {
  const { userId } = route.useParams()
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
