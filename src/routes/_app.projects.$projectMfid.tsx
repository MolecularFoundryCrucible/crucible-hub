import { loadIncludePublicByDefault } from "@/features/preferences/public-data"
import { createFileRoute } from "@tanstack/react-router"
import { EntityWorkspacePending } from "@/components/crucible/resource-tab-state"
import { projectQueryOptions } from "@/data/crucible/projects.queries"
import { hubPageTitle } from "@/lib/page-title"
import { resourceDisplayName } from "@/lib/resource-name"
import {
  loadDataGroupBy,
  loadDefaultSort,
} from "@/features/preferences/data-group-by"
import { ProjectWorkspace } from "@/features/projects/project-layout"

export const Route = createFileRoute("/_app/projects/$projectMfid")({
  staleTime: Infinity,
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const [project, dataGroupBy, defaultSort, includePublicByDefault] =
      await Promise.all([
        context.queryClient.ensureQueryData(
          projectQueryOptions(source.scope, params.projectMfid)
        ),
        loadDataGroupBy(
          context.queryClient,
          source.scope,
          source.accountPreferencesEnabled
        ),
        loadDefaultSort(
          context.queryClient,
          source.scope,
          source.accountPreferencesEnabled
        ),
        source.accountPreferencesEnabled
          ? loadIncludePublicByDefault(context.queryClient, source.scope)
          : false,
      ])
    return {
      dataGroupBy,
      defaultSort,
      includePublicByDefault,
      isProject: Boolean(project),
      projectMfid: project?.unique_id ?? params.projectMfid,
      projectName: project
        ? resourceDisplayName("project", project.title, {
            identifier: project.project_id,
            mfid: project.unique_id,
          })
        : undefined,
      scope: source.scope,
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: hubPageTitle(loaderData?.projectName) }],
  }),
  pendingComponent: () => <EntityWorkspacePending kind="project" />,
  component: ProjectWorkspace,
})
