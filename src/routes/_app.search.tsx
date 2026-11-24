import { createFileRoute } from "@tanstack/react-router"
import { SearchRoutePending } from "@/components/crucible/route-content-pending"
import { SearchPage } from "@/features/search/search-page"
import { searchSchema } from "@/features/search/search-filter-state"

export const Route = createFileRoute("/_app/search")({
  head: () => ({ meta: [{ title: "Search | Crucible Hub" }] }),
  validateSearch: searchSchema,
  pendingComponent: SearchRoutePending,
  component: SearchPage,
})
