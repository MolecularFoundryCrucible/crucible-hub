import { Link } from "@tanstack/react-router"
import { UsersIcon } from "lucide-react"

import {
  AccessRoleBadge,
  accessRoleRank,
} from "@/components/crucible/access-role-badge"
import { PersonLink } from "@/components/crucible/person-link"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
    <Card>
      <CardHeader>
        <CardTitle>People</CardTitle>
        {manageMembers && projectMfid ? (
          <CardAction>
            <Link
              className={buttonVariants({ size: "sm", variant: "outline" })}
              params={{ projectMfid }}
              to="/projects/$projectMfid/settings"
            >
              Manage members
            </Link>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        {members ? (
          members.length ? (
            sortProjectMembers(members).map((member) => (
              <div
                className="flex min-w-0 items-center gap-3"
                key={member.unique_id}
              >
                <PersonLink
                  className="flex-1"
                  person={member}
                  presentation="avatar"
                />
                <ProjectRoleBadge role={member.role} />
              </div>
            ))
          ) : (
            <p className="text-body text-muted-foreground">
              No members are currently listed.
            </p>
          )
        ) : (
          <div className="flex items-center gap-2 text-body text-muted-foreground">
            <UsersIcon aria-hidden="true" />
            Detailed membership is not available.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
