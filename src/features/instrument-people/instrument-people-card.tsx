import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { AccessRoleBadge } from "@/components/crucible/access-role-badge"
import { PanelState } from "@/components/crucible/collection-state"
import { PeopleCard } from "@/components/crucible/people-card"
import type { PeopleCardEntry } from "@/components/crucible/people-card"
import { PersonLink } from "@/components/crucible/person-link"
import { sortProjectMembers } from "@/components/crucible/project-members"
import { buttonVariants } from "@/components/ui/button"
import { instrumentMembersQueryOptions } from "@/data/crucible/instruments.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import type { WorkspaceInstrumentMember } from "@/data/crucible/workspace-source"

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
      entries={query.data ? instrumentPeopleEntries(query.data) : query.data}
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

export function instrumentPeopleEntries(
  members: readonly WorkspaceInstrumentMember[]
): PeopleCardEntry[] {
  return sortProjectMembers(members).map((member) => ({
    key: member.unique_id,
    person: (
      <PersonLink className="flex-1" person={member} presentation="avatar" />
    ),
    role: <InstrumentRoleBadge role={member.role} />,
  }))
}

export function InstrumentRoleBadge({ role }: { role: string }) {
  return (
    <AccessRoleBadge
      label={role === "owner" ? "Manager" : undefined}
      role={role}
    />
  )
}
