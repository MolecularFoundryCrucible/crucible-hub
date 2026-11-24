import { useQuery } from "@tanstack/react-query"
import { GlobalSearch } from "@/components/crucible/global-search"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  projectQueryOptions,
  projectSummaryQueryOptions,
} from "@/data/crucible/projects.queries"
import { resourceDisplayName } from "@/lib/resource-name"

export function AppSearch({
  preferFullProject,
  projectMfid,
  scope,
}: {
  preferFullProject: boolean
  projectMfid?: string
  scope?: IdentityScope
}) {
  if (!projectMfid || !scope) return <GlobalSearch scope={scope} />
  return (
    <ProjectContextSearch
      preferFullProject={preferFullProject}
      projectMfid={projectMfid}
      scope={scope}
    />
  )
}

function ProjectContextSearch({
  preferFullProject,
  projectMfid,
  scope,
}: {
  preferFullProject: boolean
  projectMfid: string
  scope: IdentityScope
}) {
  return preferFullProject ? (
    <ProjectContextSearchOverview projectMfid={projectMfid} scope={scope} />
  ) : (
    <ProjectContextSearchSummary projectMfid={projectMfid} scope={scope} />
  )
}

function ProjectContextSearchOverview({
  projectMfid,
  scope,
}: {
  projectMfid: string
  scope: IdentityScope
}) {
  const { data: project } = useQuery(projectQueryOptions(scope, projectMfid))
  return (
    <ProjectSearchAction
      project={project}
      projectMfid={projectMfid}
      scope={scope}
    />
  )
}

function ProjectContextSearchSummary({
  projectMfid,
  scope,
}: {
  projectMfid: string
  scope: IdentityScope
}) {
  const { data: project } = useQuery(
    projectSummaryQueryOptions(scope, projectMfid)
  )
  return (
    <ProjectSearchAction
      project={project}
      projectMfid={projectMfid}
      scope={scope}
    />
  )
}

function ProjectSearchAction({
  project,
  projectMfid,
  scope,
}: {
  project?: { project_id: string; title?: string | null } | null
  projectMfid: string
  scope: IdentityScope
}) {
  return (
    <GlobalSearch
      projectMfid={projectMfid}
      projectName={
        project
          ? resourceDisplayName("project", project.title, {
              identifier: project.project_id,
              mfid: projectMfid,
            })
          : undefined
      }
      scope={scope}
    />
  )
}

export function activeProjectMfid(
  pathname: string,
  search: Record<string, unknown>
) {
  const routeProjectMfid = pathname.match(/^\/projects\/([^/]+)/)?.[1]
  if (routeProjectMfid) return routeProjectMfid

  const contextualProjectMfid =
    pathname === "/search"
      ? search.projectMfid
      : /^\/(datasets|samples)\/[^/]+/.test(pathname)
        ? search.fromProject
        : undefined
  return typeof contextualProjectMfid === "string"
    ? contextualProjectMfid
    : undefined
}
