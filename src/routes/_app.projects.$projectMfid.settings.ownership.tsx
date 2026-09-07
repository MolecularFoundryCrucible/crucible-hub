import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ContentBoundary } from "@/components/crucible/content-layout"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { OwnershipTransferCard } from "@/features/resource-ownership/ownership-transfer-card"

export const Route = createFileRoute(
  "/_app/projects/$projectMfid/settings/ownership"
)({
  component: ProjectOwnershipSettingsPage,
})

function ProjectOwnershipSettingsPage() {
  const { projectMfid } = Route.useParams()
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, projectMfid)
  )

  if (!resource || resource.kind !== "project") return null
  return (
    <ContentBoundary width="action">
      <OwnershipTransferCard mode={mode} resource={resource} scope={scope} />
    </ContentBoundary>
  )
}
