import { useSuspenseQuery } from "@tanstack/react-query"
import { Navigate, createFileRoute } from "@tanstack/react-router"

import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { ProjectSettingsForm } from "@/features/management-settings/settings-forms"
import { projectMembershipActions } from "@/features/project-membership/project-membership-access"
import { projectQueryOptions } from "@/data/crucible/projects.queries"

export const Route = createFileRoute("/_app/projects/$projectMfid/settings/")({
  component: ProjectGeneralSettingsPage,
})

function ProjectGeneralSettingsPage() {
  const { projectMfid } = Route.useParams()
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const { data: project } = useSuspenseQuery(
    projectQueryOptions(scope, projectMfid)
  )

  if (!project || !("organization" in project)) return null

  if (project.capabilities?.can_edit !== true) {
    const { canUseMembership } = projectMembershipActions(project, scope[2])
    return (
      <Navigate
        params={{ projectMfid }}
        replace
        to={
          canUseMembership
            ? "/projects/$projectMfid/settings/members"
            : "/projects/$projectMfid/settings/ownership"
        }
      />
    )
  }

  return <ProjectSettingsForm mode={mode} project={project} scope={scope} />
}
