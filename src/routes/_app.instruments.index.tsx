import { createFileRoute } from "@tanstack/react-router"
import {
  instrumentPageLimit,
  instrumentsCursorQueryOptions,
} from "@/data/crucible/instruments.queries"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import { loadDefaultSort } from "@/features/preferences/data-group-by"
import {
  InstrumentsRoutePending,
  InstrumentsPage,
} from "@/features/instruments/instruments-page"
import { instrumentSearchSchema } from "@/features/instruments/instruments-search"

export const Route = createFileRoute("/_app/instruments/")({
  head: () => ({ meta: [{ title: "Instruments | Crucible Hub" }] }),
  validateSearch: instrumentSearchSchema,
  loaderDeps: ({ search }) => ({
    affiliation: search.affiliation,
    cursor: search.cursor,
    direction: search.direction,
    instrumentType: search.instrumentType,
    location: search.location,
    manufacturer: search.manufacturer,
    ownerId: search.ownerId,
    sort: search.sort,
    status: search.status ?? "active",
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const defaultSort = await loadDefaultSort(
      context.queryClient,
      source.scope,
      source.accountPreferencesEnabled
    )
    const preferredSort = defaultSort?.instruments
    const effectiveSort = deps.sort ?? preferredSort?.sort
    const effectiveDirection =
      deps.direction ?? (deps.sort ? undefined : preferredSort?.direction)

    const options = instrumentsCursorQueryOptions(source.scope, {
      affiliation: deps.affiliation,
      cursor: deps.cursor,
      direction: effectiveSort ? effectiveDirection : undefined,
      includeOwner: true,
      includeTotal: true,
      instrumentType: deps.instrumentType,
      limit: instrumentPageLimit,
      location: deps.location,
      manufacturer: deps.manufacturer,
      ownerId: deps.ownerId,
      sort: effectiveSort,
      status: deps.status === "all" ? undefined : deps.status,
    })
    const request = prefetchInfiniteQueryWithReadableCache(
      context.queryClient,
      options
    )
    if (cause !== "stay" && request) await request
    return { defaultSort }
  },
  pendingComponent: InstrumentsRoutePending,
  staleTime: Infinity,
  component: InstrumentsPage,
})
