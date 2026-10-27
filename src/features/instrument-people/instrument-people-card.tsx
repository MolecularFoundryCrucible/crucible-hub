import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import {
  AccessRoleBadge,
  sortAccessGrants,
} from "@/components/crucible/access-role-badge"
import { PanelState } from "@/components/crucible/collection-state"
import { PeopleCard } from "@/components/crucible/people-card"
import { PersonLink } from "@/components/crucible/person-link"
import { ResourceIdentityLink } from "@/components/crucible/resource-identity-link"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import { buttonVariants } from "@/components/ui/button"
import { instrumentMembersQueryOptions } from "@/data/crucible/instruments.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { grantKey, grantName } from "@/data/crucible/resource-access"
import type { WorkspaceResourceAccessGrant } from "@/data/crucible/workspace-source"

export function InstrumentPeopleCard({
  canManageAccess,
  instrumentMfid,
  scope,
}: {
  canManageAccess: boolean
  instrumentMfid: string
  scope: IdentityScope
}) {
  const query = useQuery(instrumentMembersQueryOptions(scope, instrumentMfid))

  return (
    <PeopleCard
      action={
        canManageAccess ? (
          <Link
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            params={{ instrumentMfid }}
            to="/instruments/$instrumentMfid/settings"
          >
            Manage members
          </Link>
        ) : undefined
      }
      entries={
        query.data
          ? sortAccessGrants(query.data).map((grant) => ({
              key: grantKey(grant),
              person: <InstrumentMemberIdentity grant={grant} />,
              role: (
                <AccessRoleBadge
                  label={grant.permission === "owner" ? "Manager" : undefined}
                  role={grant.permission}
                />
              ),
            }))
          : query.data
      }
      error={
        query.isError ? (
          <PanelState
            retry={() => void query.refetch()}
            role="alert"
            title="People could not be loaded"
          />
        ) : undefined
      }
      pending={query.isPending}
    />
  )
}

export function InstrumentMemberIdentity({
  grant,
}: {
  grant: WorkspaceResourceAccessGrant
}) {
  if (grant.principal_type === "project") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="entity-icon-well entity-icon-well-lg rounded-full">
          <ResourceTypeIcon type="project" />
        </span>
        <div className="min-w-0">
          <ResourceIdentityLink
            className="block truncate text-label"
            context={grant.slug}
            kind="project"
            mfid={grant.principal_id}
            name={grantName(grant)}
          >
            {grantName(grant)}
          </ResourceIdentityLink>
          <p className="truncate text-supporting text-muted-foreground">
            {grant.slug ?? grant.principal_id}
          </p>
        </div>
      </div>
    )
  }
  return (
    <PersonLink
      className="flex-1"
      person={{
        is_service_account: grant.principal_type === "service_account",
        name: grantName(grant),
        unique_id: grant.principal_id,
        username: grant.slug,
      }}
      presentation="avatar"
    />
  )
}
