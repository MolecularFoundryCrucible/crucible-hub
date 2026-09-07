import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { ContentBoundary } from "@/components/crucible/content-layout"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { InstrumentOperatorsCard } from "@/features/instrument-operators/instrument-operators-card"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/settings/operators"
)({
  component: InstrumentOperatorsSettingsPage,
})

function InstrumentOperatorsSettingsPage() {
  const { instrumentMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, instrumentMfid)
  )

  if (!resource || resource.kind !== "instrument") return null

  return (
    <ContentBoundary width="reading">
      <InstrumentOperatorsCard instrument={resource} scope={scope} />
    </ContentBoundary>
  )
}
