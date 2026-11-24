import { accountPreferencesQueryOptions } from "@/data/crucible/preferences.queries"
import { privilegeModeFromScope } from "@/data/crucible/query-keys"
import { hashKey } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  datasetsQueryOptions,
  samplesQueryOptions,
} from "@/data/crucible/data.queries"
import { instrumentsQueryOptions } from "@/data/crucible/instruments.queries"
import { projectsQueryOptions } from "@/data/crucible/projects.queries"
import {
  homeInstrumentQuery,
  homeProjectLimit,
  homeRecentResourceFilters,
} from "@/features/home/home-data"
import { HomePage } from "@/features/home/home-page"

export const Route = createFileRoute("/_app/")({
  loader: async ({ context, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return
    const preferences = source.accountPreferencesEnabled
      ? (
          await context.queryClient
            .ensureQueryData(accountPreferencesQueryOptions(source.scope))
            .catch(() => undefined)
        )?.preferences
      : undefined
    const recentFilters = homeRecentResourceFilters({
      elevated: privilegeModeFromScope(source.scope) === "elevated",
      includePublicByDefault: preferences?.hub?.include_public_data === true,
      recentScope: preferences?.hub?.home_recent_scope ?? "all",
    })

    const sampleOptions = samplesQueryOptions(source.scope, recentFilters)
    const datasetOptions = datasetsQueryOptions(source.scope, recentFilters)
    await Promise.allSettled([
      context.queryClient.prefetchQuery(
        projectsQueryOptions(source.scope, {
          direction: "desc",
          includeTotal: false,
          limit: homeProjectLimit,
          memberRef: source.scope[2],
          sort: "activity",
        })
      ),
      context.queryClient.prefetchQuery(
        instrumentsQueryOptions(source.scope, homeInstrumentQuery)
      ),
      context.queryClient.prefetchQuery(sampleOptions),
      context.queryClient.prefetchQuery(datasetOptions),
    ])
    return {
      failedRecentQueries: [sampleOptions, datasetOptions]
        .filter(
          (options) =>
            context.queryClient.getQueryState(options.queryKey)?.status ===
            "error"
        )
        .map((options) => hashKey(options.queryKey)),
      greetingAt: Date.now(),
    }
  },
  component: HomePage,
})
