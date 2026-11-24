import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Outlet, getRouteApi } from "@tanstack/react-router"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import {
  PersonAvatar,
  personDisplayName,
} from "@/components/crucible/person-identity"
import {
  ResourceSectionNavigation,
  ResourceSectionPanel,
  resourceSectionActiveProps,
  resourceSectionLinkClassName,
} from "@/components/crucible/resource-section-navigation"
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { canOpenServiceAccountAdministration } from "@/data/crucible/administration"
import { AdministrationUnavailable } from "@/components/crucible/administrator-view-required"
import { serviceAccountAdminQueryOptions } from "@/data/crucible/service-accounts.queries"
import { formatUsername } from "@/lib/username"

const route = getRouteApi("/_app/admin/service-accounts/$serviceAccountMfid")

export function ServiceAccountAdminPage() {
  const { serviceAccountMfid } = route.useParams()
  const scope = useWorkspaceScope()
  const administrationScope = useAdministrationScope()
  const privilegeMode = useWorkspacePrivilegeMode()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))

  if (!canOpenServiceAccountAdministration(account, privilegeMode)) {
    return (
      <AdministrationUnavailable
        account={account}
        description="Turn on administrator view to manage this service account."
        title="Service account"
      />
    )
  }

  return (
    <ServiceAccountAdminDetail
      administrationScope={administrationScope}
      serviceAccountMfid={serviceAccountMfid}
    />
  )
}

function ServiceAccountAdminDetail({
  administrationScope,
  serviceAccountMfid,
}: {
  administrationScope: ReturnType<typeof useAdministrationScope>
  serviceAccountMfid: string
}) {
  const serviceAccountResult = useSuspenseQuery(
    serviceAccountAdminQueryOptions(administrationScope, serviceAccountMfid)
  )

  if (!serviceAccountResult.data) {
    return (
      <Card className="mx-auto mt-16 max-w-state">
        <CardHeader>
          <CardTitle>Service account not found</CardTitle>
          <CardDescription>
            This service account doesn't exist or you don't have access to it.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const serviceAccount = serviceAccountResult.data
  const title = personDisplayName(serviceAccount)

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
        avatar={<PersonAvatar person={serviceAccount} size="lg" />}
        eyebrow="Service account"
        identifier={
          serviceAccount.username
            ? formatUsername(serviceAccount.username, "handle")
            : undefined
        }
        title={title}
      />
      <ResourceSectionNavigation label="Service account sections">
        <Link
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          params={{ serviceAccountMfid }}
          to="/admin/service-accounts/$serviceAccountMfid"
          viewTransition
        >
          Overview
        </Link>
        <Link
          activeOptions={{ includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          params={{ serviceAccountMfid }}
          to="/admin/service-accounts/$serviceAccountMfid/security"
          viewTransition
        >
          Security
        </Link>
      </ResourceSectionNavigation>
      <ResourceSectionPanel>
        <Outlet />
      </ResourceSectionPanel>
    </PageLayout>
  )
}
