import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Outlet, createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/crucible/page-header"
import { EntityRefreshAction } from "@/components/crucible/entity-refresh-action"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceCreationActions } from "@/components/crucible/resource-creation-actions"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import {
  ResourceSectionNavigation,
  resourceSectionActiveProps,
  resourceSectionLinkClassName,
} from "@/components/crucible/resource-section-navigation"
import { RouteContentPending } from "@/components/crucible/route-content-pending"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { projectMembershipActions } from "@/features/project-membership/project-membership-access"
import { hubPageTitle } from "@/lib/page-title"
import { useRememberRecentlyViewed } from "@/features/recently-viewed/recently-viewed"

export const Route = createFileRoute("/_app/projects/$projectMfid")({
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const project = await context.queryClient.ensureQueryData(
      projectQueryOptions(source.scope, params.projectMfid)
    )
    return {
      isProject: Boolean(project),
      projectMfid: project?.unique_id ?? params.projectMfid,
      projectName: project?.title ?? project?.project_id,
      scope: source.scope,
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: hubPageTitle(loaderData?.projectName) }],
  }),
  pendingComponent: RouteContentPending,
  component: ProjectWorkspace,
})

function ProjectWorkspace() {
  const { projectMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const projectOptions = projectQueryOptions(scope, projectMfid)
  const { data: project, dataUpdatedAt } = useSuspenseQuery(projectOptions)
  useRememberRecentlyViewed(
    project
      ? {
          kind: "project",
          name: project.title ?? project.project_id,
          projectId: project.project_id,
          uniqueId: project.unique_id,
        }
      : null
  )

  if (!project) {
    return (
      <Card className="mx-auto mt-16 max-w-state">
        <CardHeader>
          <CardTitle>Project not found</CardTitle>
          <CardDescription>
            This project is not present in the current workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const complete = "status" in project
  const membership = projectMembershipActions(project, scope[2])
  const hasManagement =
    complete &&
    (membership.canUseMembership || project.capabilities?.can_transfer === true)

  return (
    <PageLayout>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link search={{ offset: undefined }} to="/projects" />}
            >
              Projects
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {project.title ?? project.project_id}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        eyebrow={project.project_id}
        icon={
          <ResourceTypeIcon className="mt-1 size-6 shrink-0" type="project" />
        }
        title={project.title ?? project.project_id}
      />

      <ResourceSectionNavigation
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ResourceCreationActions projectMfid={project.unique_id} />
            <EntityRefreshAction
              label={`Refresh ${project.title ?? project.project_id}`}
              queryKey={projectOptions.queryKey}
              refreshedAt={dataUpdatedAt}
            />
          </div>
        }
        label="Project sections"
      >
        <Link
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          params={{ projectMfid }}
          search={{
            datasetCursor: undefined,
            kind: undefined,
            preview: undefined,
            sampleCursor: undefined,
            scope: undefined,
          }}
          state={{}}
          to="/projects/$projectMfid"
        >
          Data
        </Link>
        <Link
          activeOptions={{ includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          params={{ projectMfid }}
          search={{}}
          state={{}}
          to="/projects/$projectMfid/overview"
        >
          Overview
        </Link>
        {hasManagement ? (
          <Link
            activeOptions={{ includeSearch: false }}
            activeProps={resourceSectionActiveProps}
            className={resourceSectionLinkClassName}
            params={{ projectMfid }}
            search={{}}
            state={{}}
            to="/projects/$projectMfid/settings"
          >
            Manage
          </Link>
        ) : null}
      </ResourceSectionNavigation>

      <Outlet />
    </PageLayout>
  )
}
