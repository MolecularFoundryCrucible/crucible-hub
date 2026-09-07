import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Outlet, createFileRoute } from "@tanstack/react-router"

import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/settings"
)({
  component: InstrumentSettingsPage,
})

function InstrumentSettingsPage() {
  const { instrumentMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, instrumentMfid)
  )

  if (!resource || resource.kind !== "instrument") return null
  const canEditDescription = resource.capabilities?.can_edit === true
  const canChangeStatus = resource.capabilities?.can_change_status === true
  const canManageOperators = resource.capabilities?.can_manage_access === true
  const canTransferOwnership = resource.capabilities?.can_transfer === true

  if (
    !canEditDescription &&
    !canChangeStatus &&
    !canManageOperators &&
    !canTransferOwnership
  ) {
    return <SettingsUnavailable />
  }

  return (
    <div className="flex min-w-0 flex-col gap-page-section">
      <nav
        aria-label="Instrument settings sections"
        className="flex flex-wrap gap-x-4 gap-y-2"
      >
        {canEditDescription ? (
          <Link
            activeOptions={{ exact: true, includeSearch: false }}
            activeProps={{ className: "text-label text-foreground underline" }}
            className="text-body text-muted-foreground hover:text-foreground"
            params={{ instrumentMfid }}
            to="/instruments/$instrumentMfid/settings"
          >
            General
          </Link>
        ) : null}
        {canChangeStatus ? (
          <Link
            activeOptions={{ includeSearch: false }}
            activeProps={{ className: "text-label text-foreground underline" }}
            className="text-body text-muted-foreground hover:text-foreground"
            params={{ instrumentMfid }}
            to="/instruments/$instrumentMfid/settings/lifecycle"
          >
            Lifecycle
          </Link>
        ) : null}
        {canManageOperators ? (
          <Link
            activeOptions={{ includeSearch: false }}
            activeProps={{ className: "text-label text-foreground underline" }}
            className="text-body text-muted-foreground hover:text-foreground"
            params={{ instrumentMfid }}
            to="/instruments/$instrumentMfid/settings/operators"
          >
            Operators
          </Link>
        ) : null}
        {canTransferOwnership ? (
          <Link
            activeOptions={{ includeSearch: false }}
            activeProps={{ className: "text-label text-foreground underline" }}
            className="text-body text-muted-foreground hover:text-foreground"
            params={{ instrumentMfid }}
            to="/instruments/$instrumentMfid/settings/ownership"
          >
            Ownership
          </Link>
        ) : null}
      </nav>
      <Outlet />
    </div>
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
        You do not have an available instrument management action.
      </CardContent>
    </Card>
  )
}
