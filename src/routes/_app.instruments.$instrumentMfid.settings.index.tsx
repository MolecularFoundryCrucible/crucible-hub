import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import {
  ResourceManagementPending,
  ResourceTabLoadError,
} from "@/components/crucible/resource-tab-state"
import { ContentBoundary } from "@/components/crucible/content-layout"
import {
  useWorkspaceMode,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  preloadResourceDetail,
  resourceQueryOptions,
} from "@/data/crucible/resources.queries"
import { InstrumentLifecycleCard } from "@/features/instrument-lifecycle/instrument-lifecycle-card"
import { InstrumentOperatorsCard } from "@/features/instrument-operators/instrument-operators-card"
import { OwnershipTransferCard } from "@/features/resource-ownership/ownership-transfer-card"
import { ResourceForcedDeletionCard } from "@/features/resource-deletion/resource-forced-deletion"

export const Route = createFileRoute(
  "/_app/instruments/$instrumentMfid/settings/"
)({
  loader: async ({ context, parentMatchPromise }) => {
    const parent = (await parentMatchPromise).loaderData
    if (!parent?.instrumentMfid) return
    await preloadResourceDetail(
      context.queryClient,
      parent.scope,
      parent.instrumentMfid
    )
  },
  pendingComponent: ResourceManagementPending,
  errorComponent: ResourceTabLoadError,
  component: InstrumentManagePage,
})

function InstrumentManagePage() {
  const { instrumentMfid } = Route.useParams()
  const mode = useWorkspaceMode()
  const scope = useWorkspaceScope()
  const navigate = useNavigate({
    from: "/instruments/$instrumentMfid/settings/",
  })
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, instrumentMfid)
  )

  if (!resource || resource.kind !== "instrument") return null

  const canChangeStatus = resource.capabilities?.can_change_status === true
  const canManageAccess = resource.capabilities?.can_manage_access === true
  const canTransfer = resource.capabilities?.can_transfer === true
  const canDelete = resource.capabilities?.can_delete === true
  const hasResourceManagement = canChangeStatus || canTransfer || canDelete

  if (!canManageAccess && !hasResourceManagement) {
    return <ManagementUnavailable />
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {canManageAccess ? (
        <ContentBoundary width="reading">
          <InstrumentOperatorsCard instrument={resource} scope={scope} />
        </ContentBoundary>
      ) : null}
      {hasResourceManagement ? (
        <ContentBoundary width="reading">
          <Card>
            <CardHeader>
              <CardTitle>Resource management</CardTitle>
            </CardHeader>
            <CardContent className="divide-y px-0">
              {canChangeStatus ? (
                <InstrumentLifecycleCard
                  instrument={resource}
                  mode={mode}
                  presentation="row"
                  scope={scope}
                />
              ) : null}
              {canTransfer ? (
                <OwnershipTransferCard
                  mode={mode}
                  presentation="row"
                  resource={resource}
                  scope={scope}
                />
              ) : null}
              {canDelete ? (
                <ResourceForcedDeletionCard
                  onSuccess={() =>
                    void navigate({
                      replace: true,
                      search: { cursor: undefined },
                      to: "/instruments",
                    })
                  }
                  presentation="row"
                  resource={resource}
                  scope={scope}
                />
              ) : null}
            </CardContent>
          </Card>
        </ContentBoundary>
      ) : null}
    </div>
  )
}

function ManagementUnavailable() {
  return (
    <ContentBoundary width="reading">
      <Card>
        <CardHeader>
          <CardTitle aria-level={2} role="heading">
            Management unavailable
          </CardTitle>
        </CardHeader>
        <CardContent className="text-body text-muted-foreground">
          You do not have an available instrument management action.
        </CardContent>
      </Card>
    </ContentBoundary>
  )
}
