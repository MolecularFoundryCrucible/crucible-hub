import { createFileRoute } from "@tanstack/react-router"

import {
  ResourceManagementPending,
  ResourceTabLoadError,
} from "@/components/crucible/resource-tab-state"
import { preloadResourceDetail } from "@/data/crucible/resources.queries"
import { ResourceManagePage } from "@/features/resource-access/resource-manage-page"

export const Route = createFileRoute("/_app/datasets/$datasetMfid/manage")({
  loader: async ({ context, parentMatchPromise }) => {
    const parent = (await parentMatchPromise).loaderData
    if (!parent?.resourceMfid) return
    await preloadResourceDetail(
      context.queryClient,
      parent.scope,
      parent.resourceMfid
    )
  },
  pendingComponent: ResourceManagementPending,
  errorComponent: ResourceTabLoadError,
  component: DatasetManagePage,
})

function DatasetManagePage() {
  const { datasetMfid } = Route.useParams()
  return (
    <ResourceManagePage resourceKind="dataset" resourceMfid={datasetMfid} />
  )
}
