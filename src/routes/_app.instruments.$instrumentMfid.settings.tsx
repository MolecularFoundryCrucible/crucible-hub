import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InstrumentSettingsForm } from "@/features/management-settings/settings-forms"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/settings"
)({
  component: InstrumentSettingsPage,
})

function InstrumentSettingsPage() {
  const { instrumentMfid } = Route.useParams()
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, instrumentMfid)
  )

  if (!resource || resource.kind !== "instrument") return null
  if (resource.capabilities?.can_edit !== true) {
    return <SettingsUnavailable />
  }

  return (
    <InstrumentSettingsForm instrument={resource} mode={mode} scope={scope} />
  )
}

function SettingsUnavailable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle aria-level={2} role="heading">
          Settings unavailable
        </CardTitle>
      </CardHeader>
      <CardContent className="text-body text-muted-foreground">
        You do not have permission to edit this instrument.
      </CardContent>
    </Card>
  )
}
