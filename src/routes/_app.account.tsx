import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Outlet, createFileRoute } from "@tanstack/react-router"

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
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { formatUsername } from "@/lib/username"

export const Route = createFileRoute("/_app/account")({
  head: () => ({ meta: [{ title: "Profile | Crucible Hub" }] }),
  component: AccountLayout,
})

function AccountLayout() {
  const scope = useWorkspaceScope()
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))

  return (
    <PageLayout>
      <PageHeader
        avatar={<PersonAvatar person={account} size="lg" />}
        eyebrow="My profile"
        identifier={
          account.username
            ? formatUsername(account.username, "handle")
            : undefined
        }
        title={personDisplayName(account)}
      />
      <ResourceSectionNavigation label="Profile sections">
        <Link
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          to="/account"
          viewTransition
        >
          Overview
        </Link>
        <Link
          activeOptions={{ includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          to="/account/security"
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
