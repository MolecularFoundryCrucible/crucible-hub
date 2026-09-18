import { createFileRoute } from "@tanstack/react-router"

import {
  ResourceOverviewPending,
  ResourceTabLoadError,
} from "@/components/crucible/resource-tab-state"
import {
  datasetFilesQueryOptions,
  preloadResourceDetail,
} from "@/data/crucible/resources.queries"
import { ResourceOverview } from "@/features/resource-detail/resource-detail-page"

export const Route = createFileRoute("/_app/datasets/$datasetMfid/")({
  loader: async ({ context, parentMatchPromise }) => {
    const parent = (await parentMatchPromise).loaderData
    if (!parent?.resourceMfid) return
    await preloadResourceDetail(
      context.queryClient,
      parent.scope,
      parent.resourceMfid
    )
    void context.queryClient.prefetchQuery(
      datasetFilesQueryOptions(parent.scope, parent.resourceMfid)
    )
  },
  pendingComponent: () => <ResourceOverviewPending resourceKind="dataset" />,
  errorComponent: ResourceTabLoadError,
  component: DatasetOverviewPage,
})

function DatasetOverviewPage() {
  const { datasetMfid } = Route.useParams()
  return <ResourceOverview resourceKind="dataset" resourceMfid={datasetMfid} />
}
