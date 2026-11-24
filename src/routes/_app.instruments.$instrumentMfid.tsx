import { loadIncludePublicByDefault } from "@/hooks/public-data"
import { createFileRoute } from "@tanstack/react-router"
import { EntityWorkspacePending } from "@/components/crucible/resource-tab-state"
import { resourceSummaryQueryOptions } from "@/data/crucible/resources.queries"
import { hubPageTitle } from "@/lib/page-title"
import { resourceDisplayName } from "@/lib/resource-name"
import {
  loadDataGroupBy,
  loadDefaultSort,
} from "@/features/preferences/data-group-by"
import { InstrumentPage } from "@/features/instruments/instrument-layout"

export const Route = createFileRoute("/_app/instruments/$instrumentMfid")({
  staleTime: Infinity,
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const [resource, dataGroupBy, defaultSort, includePublicByDefault] =
      await Promise.all([
        context.queryClient.ensureQueryData(
          resourceSummaryQueryOptions(source.scope, params.instrumentMfid)
        ),
        loadDataGroupBy(
          context.queryClient,
          source.scope,
          source.accountPreferencesEnabled
        ),
        loadDefaultSort(
          context.queryClient,
          source.scope,
          source.accountPreferencesEnabled
        ),
        source.accountPreferencesEnabled
          ? loadIncludePublicByDefault(context.queryClient, source.scope)
          : false,
      ])
    if (!resource || resource.kind !== "instrument") {
      return { isInstrument: false, scope: source.scope }
    }
    return {
      dataGroupBy,
      defaultSort,
      includePublicByDefault,
      instrumentMfid: resource.unique_id,
      instrumentName: resourceDisplayName("instrument", resource.name, {
        identifier: resource.instrument_id,
        mfid: resource.unique_id,
      }),
      isInstrument: true,
      role: resource.role ?? null,
      scope: source.scope,
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: hubPageTitle(loaderData?.instrumentName) }],
  }),
  pendingComponent: () => <EntityWorkspacePending kind="instrument" />,
  component: InstrumentPage,
})
