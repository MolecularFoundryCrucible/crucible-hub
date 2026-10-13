import { createFileRoute, notFound, redirect } from "@tanstack/react-router"

import {
  ResourceWorkspace,
  isResourceOverviewPath,
  preloadResourceShell,
} from "@/features/resource-detail/resource-detail-page"
import { resourceDetailSearchSchema } from "@/components/crucible/resource-preview-navigation"
import { EntityWorkspacePending } from "@/components/crucible/resource-tab-state"
import { hubPageTitle } from "@/lib/page-title"
import { resourceDisplayName } from "@/lib/resource-name"

export const Route = createFileRoute("/_app/samples/$sampleMfid")({
  validateSearch: resourceDetailSearchSchema,
  staleTime: Infinity,
  loader: async ({ context, location, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const resource = await preloadResourceShell(
      context.queryClient,
      source.scope,
      params.sampleMfid,
      false,
      isResourceOverviewPath(location.pathname, params.sampleMfid)
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
    return {
      resourceMfid: resource.unique_id,
      resourceName: resourceDisplayName("sample", resource.name),
      scope: source.scope,
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: hubPageTitle(loaderData?.resourceName) }],
  }),
  pendingComponent: () => <EntityWorkspacePending kind="sample" />,
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
