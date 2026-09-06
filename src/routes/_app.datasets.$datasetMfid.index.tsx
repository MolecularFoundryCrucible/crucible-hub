import { createFileRoute } from "@tanstack/react-router"

import { datasetFilesQueryOptions } from "@/data/crucible/resources.queries"
import { ResourceOverview } from "@/features/resource-detail/resource-detail-page"

export const Route = createFileRoute("/_app/datasets/$datasetMfid/")({
  loader: async ({ context, parentMatchPromise }) => {
    const parent = (await parentMatchPromise).loaderData
    if (!parent?.resourceMfid) return
    void context.queryClient.prefetchQuery(
      datasetFilesQueryOptions(parent.scope, parent.resourceMfid)
    )
  },
  component: DatasetOverviewPage,
})

function DatasetOverviewPage() {
  const { datasetMfid } = Route.useParams()
  return <ResourceOverview resourceKind="dataset" resourceMfid={datasetMfid} />
}
