import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { ProjectMembershipCard } from "@/features/project-membership/project-membership-card"
import { projectQueryOptions } from "@/data/crucible/projects.queries"

export const Route = createFileRoute(
  "/_app/projects/$projectMfid/settings/members"
)({
  component: ProjectMemberSettingsPage,
})

function ProjectMemberSettingsPage() {
  const { projectMfid } = Route.useParams()
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const navigate = useNavigate({
    from: "/projects/$projectMfid/settings/members",
  })
  const { data: project } = useSuspenseQuery(
    projectQueryOptions(scope, projectMfid)
  )

  if (!project || !("organization" in project)) return null

  return (
    <ProjectMembershipCard
      accountId={scope[2]}
      mode={mode}
      onLeaveSuccess={() =>
        void navigate({
          replace: true,
          search: { offset: undefined },
          to: "/projects",
        })
      }
      project={{
        ...project,
        members: project.members ?? null,
      }}
      scope={scope}
    />
  )
}
