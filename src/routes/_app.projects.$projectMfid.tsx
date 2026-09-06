import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Outlet, createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { RouteContentPending } from "@/components/crucible/route-content-pending"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
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
      scope: source.scope,
    }
  },
  pendingComponent: RouteContentPending,
  component: ProjectWorkspace,
})

function ProjectWorkspace() {
  const { projectMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const { data: project } = useSuspenseQuery(
    projectQueryOptions(scope, projectMfid)
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
  const hasSettings =
    complete &&
    (project.capabilities?.can_edit === true || membership.canUseMembership)

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
        title={project.title ?? project.project_id}
        actions={
          <Badge variant={complete ? "secondary" : "outline"}>
            {complete
              ? (project.status ?? "Status unavailable")
              : "Limited details"}
          </Badge>
        }
      />

      <nav className="flex gap-1 border-b" aria-label="Project sections">
        <Link
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={{
            className: "border-b-2 border-primary text-label text-foreground",
          }}
          className="px-3 pb-3 text-body text-muted-foreground"
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
          activeProps={{
            className: "border-b-2 border-primary text-label text-foreground",
          }}
          className="px-3 pb-3 text-body text-muted-foreground"
          params={{ projectMfid }}
          search={{}}
          state={{}}
          to="/projects/$projectMfid/overview"
        >
          Overview
        </Link>
        {hasSettings ? (
          <Link
            activeOptions={{ includeSearch: false }}
            activeProps={{
              className: "border-b-2 border-primary text-label text-foreground",
            }}
            className="px-3 pb-3 text-body text-muted-foreground"
            params={{ projectMfid }}
            search={{}}
            state={{}}
            to="/projects/$projectMfid/settings"
          >
            Settings
          </Link>
        ) : null}
      </nav>

      <Outlet />
    </PageLayout>
  )
}
