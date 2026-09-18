import { createFileRoute } from "@tanstack/react-router"

import {
  ResourceManagementPending,
  ResourceTabLoadError,
} from "@/components/crucible/resource-tab-state"
import { preloadResourceDetail } from "@/data/crucible/resources.queries"
import { ResourceManagePage } from "@/features/resource-access/resource-manage-page"

export const Route = createFileRoute("/_app/samples/$sampleMfid/manage")({
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
  component: SampleManagePage,
})

function SampleManagePage() {
  const { sampleMfid } = Route.useParams()
  return <ResourceManagePage resourceKind="sample" resourceMfid={sampleMfid} />
}
