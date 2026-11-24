import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Outlet, getRouteApi } from "@tanstack/react-router"
import { PageHeader } from "@/components/crucible/page-header"
import { EntityRefreshAction } from "@/components/crucible/entity-refresh-action"
import { PageLayout } from "@/components/crucible/page-layout"
import { ResourceCreationActions } from "@/components/crucible/resource-creation-actions"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import {
  ResourceSectionNavigation,
  ResourceSectionPanel,
  resourceSectionActiveProps,
  resourceSectionLinkClassName,
} from "@/components/crucible/resource-section-navigation"
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
import { accountQueryOptions } from "@/data/crucible/account.queries"
import { isProjectMember } from "@/features/join-requests/join-request-messages"
import { RequestToJoinProject } from "@/features/join-requests/request-to-join"
import { resourceDisplayName } from "@/lib/resource-name"
import { useRememberRecentlyViewed } from "@/features/recently-viewed/recently-viewed"

const route = getRouteApi("/_app/projects/$projectMfid")

export function ProjectWorkspace() {
  const { projectMfid } = route.useParams()
  const scope = useWorkspaceScope()
  const projectOptions = projectQueryOptions(scope, projectMfid)
  const { data: project, dataUpdatedAt } = useSuspenseQuery(projectOptions)
  const { data: account } = useSuspenseQuery(accountQueryOptions(scope))
  const displayName = project
    ? resourceDisplayName("project", project.title, {
        identifier: project.project_id,
        mfid: project.unique_id,
      })
    : ""
  useRememberRecentlyViewed(
    project
      ? {
          identifier: project.project_id,
          kind: "project",
          name: displayName,
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
            This project doesn't exist or you don't have access to it.
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
              render={<Link search={{ cursor: undefined }} to="/projects" />}
            >
              Projects
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{displayName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        actions={
          !account.is_service_account &&
          !isProjectMember(project, account.unique_id) ? (
            <RequestToJoinProject
              projectMfid={project.unique_id}
              projectName={displayName}
            />
          ) : null
        }
        icon={<ResourceTypeIcon className="size-5" type="project" />}
        identifier={
          project.title && project.title !== project.project_id
            ? project.project_id
            : undefined
        }
        title={displayName}
      />

      <ResourceSectionNavigation
        actions={
          <>
            <ResourceCreationActions
              projectMfid={project.unique_id}
              variant="outline"
            />
            <EntityRefreshAction
              label={`Refresh details for ${displayName}`}
              queryKey={projectOptions.queryKey}
              refreshedAt={dataUpdatedAt}
              subject="Project details"
            />
          </>
        }
        label="Project sections"
      >
        <Link
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          viewTransition
          className={resourceSectionLinkClassName}
          params={{ projectMfid }}
          search={{}}
          state={{}}
          to="/projects/$projectMfid"
        >
          Data
        </Link>
        <Link
          activeOptions={{ includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          viewTransition
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
            viewTransition
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

      <ResourceSectionPanel>
        <Outlet />
      </ResourceSectionPanel>
    </PageLayout>
  )
}
