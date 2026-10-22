import { Link } from "@tanstack/react-router"

import {
  AccessRoleBadge,
  accessRoleRank,
} from "@/components/crucible/access-role-badge"
import { PeopleCard } from "@/components/crucible/people-card"
import { PersonLink } from "@/components/crucible/person-link"
import { buttonVariants } from "@/components/ui/button"
import type { components } from "@/generated/crucible-api"

type ProjectMember = components["schemas"]["AccessGroupMemberRead"]

export function sortProjectMembers(members: readonly ProjectMember[]) {
  return [...members].sort((left, right) => {
    const roleDifference =
      accessRoleRank(left.role) - accessRoleRank(right.role)
    if (roleDifference !== 0) return roleDifference
    const lastNameDifference = left.last_name.localeCompare(right.last_name)
    if (lastNameDifference !== 0) return lastNameDifference
    const firstNameDifference = left.first_name.localeCompare(right.first_name)
    if (firstNameDifference !== 0) return firstNameDifference
    return left.unique_id.localeCompare(right.unique_id)
  })
}

export function ProjectRoleBadge({ role }: { role: string }) {
  return (
    <AccessRoleBadge
      label={role === "owner" ? "Lead" : undefined}
      role={role}
    />
  )
}

export function ProjectMembers({
  manageMembers = false,
  members,
  projectMfid,
}: {
  manageMembers?: boolean
  members: readonly ProjectMember[] | null | undefined
  projectMfid?: string
}) {
  return (
    <PeopleCard
      action={
        manageMembers && projectMfid ? (
          <Link
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            params={{ projectMfid }}
            to="/projects/$projectMfid/settings"
          >
            Manage members
          </Link>
        ) : undefined
      }
      entries={
        members
          ? sortProjectMembers(members).map((member) => ({
              key: member.unique_id,
              person: (
                <PersonLink
                  className="flex-1"
                  person={member}
                  presentation="avatar"
                />
              ),
              role: <ProjectRoleBadge role={member.role} />,
            }))
          : members
      }
    />
  )
}
