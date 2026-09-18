import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import {
  ResourceManagementPending,
  ResourceTabLoadError,
} from "@/components/crucible/resource-tab-state"
import { ContentBoundary } from "@/components/crucible/content-layout"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  preloadResourceDetail,
  resourceQueryOptions,
} from "@/data/crucible/resources.queries"
import { ProjectLeaveCard } from "@/features/project-membership/project-leave-card"
import { projectMembershipActions } from "@/features/project-membership/project-membership-access"
import { ProjectMembershipCard } from "@/features/project-membership/project-membership-card"
import { OwnershipTransferCard } from "@/features/resource-ownership/ownership-transfer-card"

export const Route = createFileRoute("/_app/projects/$projectMfid/settings/")({
  loader: async ({ context, parentMatchPromise }) => {
    const parent = (await parentMatchPromise).loaderData
    if (!parent?.projectMfid) return
    await preloadResourceDetail(
      context.queryClient,
      parent.scope,
      parent.projectMfid
    )
  },
  pendingComponent: ResourceManagementPending,
  errorComponent: ResourceTabLoadError,
  component: ProjectManagePage,
})

function ProjectManagePage() {
  const { projectMfid } = Route.useParams()
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const navigate = useNavigate({
    from: "/projects/$projectMfid/settings/",
  })
  const { data: project } = useSuspenseQuery(
    projectQueryOptions(scope, projectMfid)
  )
  if (!project || !("organization" in project)) return null

  const canTransfer = project.capabilities?.can_transfer === true
  const { canLeave, canManageAccess } = projectMembershipActions(
    project,
    scope[2]
  )
  const canManageMembers = canManageAccess || canTransfer
  const hasResourceManagement = canLeave || canTransfer

  if (!canManageMembers && !hasResourceManagement) {
    return <ManagementUnavailable />
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {canManageMembers ? (
        <ContentBoundary width="reading">
          <ProjectMembershipCard
            accountId={scope[2]}
            mode={mode}
            project={{ ...project, members: project.members ?? null }}
            scope={scope}
          />
        </ContentBoundary>
      ) : null}
      {hasResourceManagement ? (
        <ContentBoundary width="reading">
          <Card>
            <CardHeader>
              <CardTitle>Resource management</CardTitle>
            </CardHeader>
            <CardContent className="divide-y px-0">
              {canTransfer ? (
                <ProjectOwnershipRow
                  mode={mode}
                  projectMfid={projectMfid}
                  scope={scope}
                />
              ) : null}
              {canLeave ? (
                <ProjectLeaveCard
                  accountId={scope[2]}
                  mode={mode}
                  onSuccess={() =>
                    void navigate({
                      replace: true,
                      search: { cursor: undefined },
                      to: "/projects",
                    })
                  }
                  project={{ ...project, members: project.members ?? null }}
                  presentation="row"
                  scope={scope}
                />
              ) : null}
            </CardContent>
          </Card>
        </ContentBoundary>
      ) : null}
    </div>
  )
}

function ProjectOwnershipRow({
  mode,
  projectMfid,
  scope,
}: {
  mode: "api" | "fixture"
  projectMfid: string
  scope: IdentityScope
}) {
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, projectMfid)
  )
  if (!resource || resource.kind !== "project") return null
  return (
    <OwnershipTransferCard
      mode={mode}
      presentation="row"
      resource={resource}
      scope={scope}
    />
  )
}

function ManagementUnavailable() {
  return (
    <ContentBoundary width="reading">
      <Card>
        <CardHeader>
          <CardTitle aria-level={2} role="heading">
            Management unavailable
          </CardTitle>
        </CardHeader>
        <CardContent className="text-body text-muted-foreground">
          You do not have an available project management action.
        </CardContent>
      </Card>
    </ContentBoundary>
  )
}
