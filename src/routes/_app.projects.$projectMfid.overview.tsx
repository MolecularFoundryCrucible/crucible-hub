import { createFileRoute } from "@tanstack/react-router"
import { ProjectOverviewPending } from "@/components/crucible/resource-tab-state"
import { ProjectOverviewPage } from "@/features/projects/project-overview-page"

export const Route = createFileRoute("/_app/projects/$projectMfid/overview")({
  pendingComponent: ProjectOverviewPending,
  component: ProjectOverviewPage,
})
