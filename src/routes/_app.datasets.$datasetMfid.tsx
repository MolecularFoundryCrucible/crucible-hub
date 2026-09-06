import { createFileRoute, notFound, redirect } from "@tanstack/react-router"

import { resourcePreviewSearchSchema } from "@/components/crucible/resource-preview-navigation"
import { RouteContentPending } from "@/components/crucible/route-content-pending"
import {
  ResourceWorkspace,
  preloadResourceDetail,
} from "@/features/resource-detail/resource-detail-page"

export const Route = createFileRoute("/_app/datasets/$datasetMfid")({
  validateSearch: resourcePreviewSearchSchema,
  staleTime: Infinity,
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const resource = await preloadResourceDetail(
      context.queryClient,
      source.scope,
      params.datasetMfid
    )
    if (!resource) throw notFound()
    if (resource.kind === "sample") {
      throw redirect({
        params: { sampleMfid: resource.unique_id },
        search: true,
        to: "/samples/$sampleMfid",
      })
    }
    if (resource.kind !== "dataset") throw notFound()
    return { resourceMfid: resource.unique_id, scope: source.scope }
  },
  pendingComponent: RouteContentPending,
  component: DatasetPage,
})

function DatasetPage() {
  const { datasetMfid } = Route.useParams()
  const { preview } = Route.useSearch()
  return (
    <ResourceWorkspace
      preview={preview}
      resourceKind="dataset"
      resourceMfid={datasetMfid}
    />
  )
}
