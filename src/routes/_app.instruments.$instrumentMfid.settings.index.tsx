import { useSuspenseQuery } from "@tanstack/react-query"
import { Navigate, createFileRoute } from "@tanstack/react-router"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/settings/"
)({
  component: InstrumentGeneralSettingsPage,
})

function InstrumentGeneralSettingsPage() {
  const { instrumentMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, instrumentMfid)
  )

  if (!resource || resource.kind !== "instrument") return null
  const to =
    resource.capabilities?.can_change_status === true
      ? "/instruments/$instrumentMfid/settings/lifecycle"
      : resource.capabilities?.can_manage_access === true
        ? "/instruments/$instrumentMfid/settings/operators"
        : resource.capabilities?.can_transfer === true
          ? "/instruments/$instrumentMfid/settings/ownership"
          : "/instruments/$instrumentMfid"
  return <Navigate params={{ instrumentMfid }} replace to={to} />
}
