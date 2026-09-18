import { createFileRoute } from "@tanstack/react-router"

import {
  ResourceOverviewPending,
  ResourceTabLoadError,
} from "@/components/crucible/resource-tab-state"
import { preloadResourceDetail } from "@/data/crucible/resources.queries"
import { ResourceOverview } from "@/features/resource-detail/resource-detail-page"

export const Route = createFileRoute("/_app/samples/$sampleMfid/")({
  loader: async ({ context, parentMatchPromise }) => {
    const parent = (await parentMatchPromise).loaderData
    if (!parent?.resourceMfid) return
    await preloadResourceDetail(
      context.queryClient,
      parent.scope,
      parent.resourceMfid
    )
  },
  pendingComponent: () => <ResourceOverviewPending resourceKind="sample" />,
  errorComponent: ResourceTabLoadError,
  component: SampleOverviewPage,
})

function SampleOverviewPage() {
  const { sampleMfid } = Route.useParams()
  return <ResourceOverview resourceKind="sample" resourceMfid={sampleMfid} />
}
