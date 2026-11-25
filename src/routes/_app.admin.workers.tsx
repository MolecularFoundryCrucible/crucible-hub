import { createFileRoute } from "@tanstack/react-router"

import { WorkersPage } from "@/features/workers/workers-page"

export const Route = createFileRoute("/_app/admin/workers")({
  head: () => ({ meta: [{ title: "Ingestion workers | Crucible Hub" }] }),
  component: WorkersPage,
})
