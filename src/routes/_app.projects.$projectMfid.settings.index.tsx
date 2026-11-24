import { createFileRoute } from "@tanstack/react-router"
import { ResourceManagementPending } from "@/components/crucible/resource-tab-state"
import { preloadResourceDetail } from "@/data/crucible/resources.queries"
import { ProjectManagePage } from "@/features/projects/project-settings-page"

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
  component: ProjectManagePage,
})
