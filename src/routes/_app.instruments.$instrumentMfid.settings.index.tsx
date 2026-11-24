import { createFileRoute } from "@tanstack/react-router"
import { ResourceManagementPending } from "@/components/crucible/resource-tab-state"
import { preloadResourceDetail } from "@/data/crucible/resources.queries"
import { InstrumentManagePage } from "@/features/instruments/instrument-settings-page"

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/settings/"
)({
  loader: async ({ context, parentMatchPromise }) => {
    const parent = (await parentMatchPromise).loaderData
    if (!parent?.instrumentMfid) return
    await preloadResourceDetail(
      context.queryClient,
      parent.scope,
      parent.instrumentMfid
    )
  },
  pendingComponent: ResourceManagementPending,
  component: InstrumentManagePage,
})
