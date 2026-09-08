import { createFileRoute, notFound, redirect } from "@tanstack/react-router"

import { resourceDetailSearchSchema } from "@/components/crucible/resource-preview-navigation"
import { RouteContentPending } from "@/components/crucible/route-content-pending"
import { hubPageTitle } from "@/lib/page-title"
import {
  ResourceWorkspace,
  preloadResourceDetail,
} from "@/features/resource-detail/resource-detail-page"

export const Route = createFileRoute("/_app/datasets/$datasetMfid")({
  validateSearch: resourceDetailSearchSchema,
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
    return {
      resourceMfid: resource.unique_id,
      resourceName: resource.name,
      scope: source.scope,
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: hubPageTitle(loaderData?.resourceName) }],
  }),
  pendingComponent: RouteContentPending,
  component: DatasetPage,
})

function DatasetPage() {
  const { datasetMfid } = Route.useParams()
  const { fromProject, preview } = Route.useSearch()
  return (
    <ResourceWorkspace
      fromProject={fromProject}
      preview={preview}
      resourceKind="dataset"
      resourceMfid={datasetMfid}
    />
  )
}
