import { createFileRoute, notFound, redirect } from "@tanstack/react-router"

import {
  ResourceWorkspace,
  preloadResourceDetail,
} from "@/features/resource-detail/resource-detail-page"
import { resourceDetailSearchSchema } from "@/components/crucible/resource-preview-navigation"
import { RouteContentPending } from "@/components/crucible/route-content-pending"

export const Route = createFileRoute("/_app/samples/$sampleMfid")({
  validateSearch: resourceDetailSearchSchema,
  staleTime: Infinity,
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const resource = await preloadResourceDetail(
      context.queryClient,
      source.scope,
      params.sampleMfid
    )
    if (!resource) throw notFound()
    if (resource.kind === "dataset") {
      throw redirect({
        params: { datasetMfid: resource.unique_id },
        search: true,
        to: "/datasets/$datasetMfid",
      })
    }
    if (resource.kind !== "sample") throw notFound()
    return { resourceMfid: resource.unique_id, scope: source.scope }
  },
  pendingComponent: RouteContentPending,
  component: SamplePage,
})

function SamplePage() {
  const { sampleMfid } = Route.useParams()
  const { fromProject, preview } = Route.useSearch()
  return (
    <ResourceWorkspace
      fromProject={fromProject}
      preview={preview}
      resourceKind="sample"
      resourceMfid={sampleMfid}
    />
  )
}
