import { useSuspenseQuery } from "@tanstack/react-query"
import { Navigate, createFileRoute } from "@tanstack/react-router"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { projectMembershipActions } from "@/features/project-membership/project-membership-access"
import { projectQueryOptions } from "@/data/crucible/projects.queries"

export const Route = createFileRoute("/_app/projects/$projectMfid/settings/")({
  component: ProjectGeneralSettingsPage,
})

function ProjectGeneralSettingsPage() {
  const { projectMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const { data: project } = useSuspenseQuery(
    projectQueryOptions(scope, projectMfid)
  )

  if (!project || !("organization" in project)) return null

  const { canUseMembership } = projectMembershipActions(project, scope[2])
  return (
    <Navigate
      params={{ projectMfid }}
      replace
      to={
        canUseMembership
          ? "/projects/$projectMfid/settings/members"
          : project.capabilities?.can_transfer === true
            ? "/projects/$projectMfid/settings/ownership"
            : "/projects/$projectMfid/overview"
      }
    />
  )
}
