import { createFileRoute, notFound, redirect } from "@tanstack/react-router"

import { resourceDetailSearchSchema } from "@/components/crucible/resource-preview-navigation"
import { preloadResourceShell } from "@/data/crucible/resources.queries"

declare module "@tanstack/react-router" {
  interface HistoryState {
    forceResourceApiResolution?: boolean
  }
}

export const Route = createFileRoute("/_app/resources/$resourceMfid")({
  validateSearch: resourceDetailSearchSchema,
  loader: async ({ context, location, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const resource = await preloadResourceShell(
      context.queryClient,
      source.scope,
      params.resourceMfid,
      location.state.forceResourceApiResolution === true
    )
    if (!resource) throw notFound()
    if (resource.kind === "sample") {
      throw redirect({
        params: { sampleMfid: resource.unique_id },
        search: true,
        to: "/samples/$sampleMfid",
      })
    }
    if (resource.kind === "dataset") {
      throw redirect({
        params: { datasetMfid: resource.unique_id },
        search: true,
        to: "/datasets/$datasetMfid",
      })
    }
    if (resource.kind === "project") {
      throw redirect({
        params: { projectMfid: resource.unique_id },
        search: {},
        to: "/projects/$projectMfid",
      })
    }
    throw redirect({
      params: { instrumentMfid: resource.unique_id },
      search: {},
      to: "/instruments/$instrumentMfid",
    })
  },
  component: LegacyResourcePage,
})

function LegacyResourcePage() {
  return null
}
