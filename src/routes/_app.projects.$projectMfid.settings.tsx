import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Outlet, createFileRoute } from "@tanstack/react-router"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { projectMembershipActions } from "@/features/project-membership/project-membership-access"

export const Route = createFileRoute("/_app/projects/$projectMfid/settings")({
  component: ProjectSettingsLayout,
})

function ProjectSettingsLayout() {
  const { projectMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const { data: project } = useSuspenseQuery(
    projectQueryOptions(scope, projectMfid)
  )

  if (!project) return null
  if (!("organization" in project)) {
    return <SettingsUnavailable />
  }

  const canEditDescription = project.capabilities?.can_edit === true
  const { canUseMembership } = projectMembershipActions(project, scope[2])

  if (!canEditDescription && !canUseMembership) {
    return <SettingsUnavailable />
  }

  return (
    <div className="flex min-w-0 flex-col gap-page-section">
      <nav
        aria-label="Project settings sections"
        className="flex flex-wrap gap-x-4 gap-y-2"
      >
        {canEditDescription ? (
          <Link
            activeOptions={{ exact: true, includeSearch: false }}
            activeProps={{ className: "text-label text-foreground underline" }}
            className="text-body text-muted-foreground hover:text-foreground"
            params={{ projectMfid }}
            to="/projects/$projectMfid/settings"
          >
            General
          </Link>
        ) : null}
        {canUseMembership ? (
          <Link
            activeOptions={{ includeSearch: false }}
            activeProps={{ className: "text-label text-foreground underline" }}
            className="text-body text-muted-foreground hover:text-foreground"
            params={{ projectMfid }}
            to="/projects/$projectMfid/settings/members"
          >
            Members
          </Link>
        ) : null}
      </nav>
      <Outlet />
    </div>
  )
}

export function SettingsUnavailable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle aria-level={2} role="heading">
          Settings unavailable
        </CardTitle>
      </CardHeader>
      <CardContent className="text-body text-muted-foreground">
        You do not have an available project management action, or its complete
        details are unavailable.
      </CardContent>
    </Card>
  )
}
