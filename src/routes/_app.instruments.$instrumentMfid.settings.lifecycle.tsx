import { useSuspenseQuery } from "@tanstack/react-query"
import { Navigate, createFileRoute } from "@tanstack/react-router"

import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { InstrumentLifecycleCard } from "@/features/instrument-lifecycle/instrument-lifecycle-card"

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/settings/lifecycle"
)({
  component: InstrumentLifecycleSettingsPage,
})

function InstrumentLifecycleSettingsPage() {
  const { instrumentMfid } = Route.useParams()
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, instrumentMfid)
  )

  if (!resource || resource.kind !== "instrument") return null
  if (resource.capabilities?.can_change_status !== true) {
    return (
      <Navigate
        params={{ instrumentMfid }}
        replace
        to="/instruments/$instrumentMfid/settings"
      />
    )
  }

  return (
    <InstrumentLifecycleCard instrument={resource} mode={mode} scope={scope} />
  )
}
