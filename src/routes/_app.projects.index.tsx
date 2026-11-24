import { createFileRoute } from "@tanstack/react-router"
import {
  projectPageLimit,
  projectsCursorQueryOptions,
} from "@/data/crucible/projects.queries"
import { prefetchInfiniteQueryWithReadableCache } from "@/data/query-prefetch"
import { loadDefaultSort } from "@/features/preferences/data-group-by"
import {
  ProjectsRoutePending,
  ProjectsPage,
} from "@/features/projects/projects-page"
import { projectSearchSchema } from "@/features/projects/projects-search"

export const Route = createFileRoute("/_app/projects/")({
  head: () => ({ meta: [{ title: "Projects | Crucible Hub" }] }),
  validateSearch: projectSearchSchema,
  loaderDeps: ({ search }) => ({
    activeSince: search.activeSince,
    affiliation: search.affiliation,
    cursor: search.cursor,
    direction: search.direction,
    role: search.role,
    sort: search.sort,
  }),
  loader: async ({ cause, context, deps, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const defaultSort = await loadDefaultSort(
      context.queryClient,
      source.scope,
      source.accountPreferencesEnabled
    )
    const preferredSort = defaultSort?.projects
    const effectiveSort = deps.sort ?? preferredSort?.sort
    const effectiveDirection =
      deps.direction ?? (deps.sort ? undefined : preferredSort?.direction)
    const apiSort = effectiveSort === "name" ? "title" : effectiveSort
    const accountUserMfid = source.scope[2]

    const options = projectsCursorQueryOptions(source.scope, {
      activeSince: deps.activeSince,
      affiliation: deps.role ? undefined : deps.affiliation,
      cursor: deps.cursor,
      direction: apiSort ? effectiveDirection : undefined,
      includeTotal: true,
      limit: projectPageLimit,
      memberRef: deps.role ? accountUserMfid : undefined,
      memberRole: deps.role,
      sort: apiSort,
    })
    const request = prefetchInfiniteQueryWithReadableCache(
      context.queryClient,
      options
    )
    if (cause !== "stay" && request) {
      await request
    }
    return { defaultSort }
  },
  pendingComponent: ProjectsRoutePending,
  staleTime: Infinity,
  component: ProjectsPage,
})
