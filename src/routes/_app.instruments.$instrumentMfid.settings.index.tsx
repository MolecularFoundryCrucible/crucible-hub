import { useSuspenseQuery } from "@tanstack/react-query"
import { Navigate, createFileRoute } from "@tanstack/react-router"

import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { InstrumentSettingsForm } from "@/features/management-settings/settings-forms"

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/settings/"
)({
  component: InstrumentGeneralSettingsPage,
})

function InstrumentGeneralSettingsPage() {
  const { instrumentMfid } = Route.useParams()
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, instrumentMfid)
  )

  if (!resource || resource.kind !== "instrument") return null
  if (resource.capabilities?.can_edit !== true) {
    const to =
      resource.capabilities?.can_change_status === true
        ? "/instruments/$instrumentMfid/settings/lifecycle"
        : resource.capabilities?.can_manage_access === true
          ? "/instruments/$instrumentMfid/settings/operators"
          : "/instruments/$instrumentMfid/settings/ownership"
    return <Navigate params={{ instrumentMfid }} replace to={to} />
  }

  return (
    <InstrumentSettingsForm instrument={resource} mode={mode} scope={scope} />
  )
}
