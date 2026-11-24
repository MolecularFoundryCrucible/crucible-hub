import { createFileRoute, notFound } from "@tanstack/react-router"
import { accountPreferencesQueryOptions } from "@/data/crucible/preferences.queries"
import { PreferencesPage } from "@/features/preferences/preferences-page"
import { preferencesSearchSchema } from "@/features/preferences/preferences-search"

export const Route = createFileRoute("/_app/preferences")({
  validateSearch: preferencesSearchSchema,
  head: () => ({ meta: [{ title: "Preferences | Crucible Hub" }] }),
  loader: async ({ context, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (source?.status !== "ready" || !source.accountPreferencesEnabled) {
      throw notFound()
    }
    await context.queryClient.ensureQueryData(
      accountPreferencesQueryOptions(source.scope)
    )
  },
  component: PreferencesPage,
})
