import { createFileRoute } from "@tanstack/react-router"
import { ResourceOverviewPending } from "@/components/crucible/resource-tab-state"
import { preloadResourceDetail } from "@/data/crucible/resources.queries"
import { InstrumentOverviewPage } from "@/features/instruments/instrument-overview-page"

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/overview"
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
  pendingComponent: () => <ResourceOverviewPending resourceKind="instrument" />,
  component: InstrumentOverviewPage,
})
