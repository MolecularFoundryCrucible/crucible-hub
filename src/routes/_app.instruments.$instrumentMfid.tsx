import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, Outlet, createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { InstrumentStatusBadge } from "@/components/crucible/instrument-status-badge"
import { ResourceTypeIcon } from "@/components/crucible/resource-type-icon"
import {
  ResourceSectionNavigation,
  resourceSectionActiveProps,
  resourceSectionLinkClassName,
} from "@/components/crucible/resource-section-navigation"
import { RouteContentPending } from "@/components/crucible/route-content-pending"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"

export const Route = createFileRoute("/_app/instruments/$instrumentMfid")({
  loader: async ({ context, params, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (!source || source.status === "unavailable") return

    const resource = await context.queryClient.ensureQueryData(
      resourceQueryOptions(source.scope, params.instrumentMfid)
    )
    if (!resource || resource.kind !== "instrument") {
      return { isInstrument: false, scope: source.scope }
    }
    return {
      instrumentMfid: resource.unique_id,
      isInstrument: true,
      scope: source.scope,
    }
  },
  pendingComponent: RouteContentPending,
  component: InstrumentPage,
})

function InstrumentPage() {
  const { instrumentMfid } = Route.useParams()
  const scope = useWorkspaceScope()
  const { data: resource } = useSuspenseQuery(
    resourceQueryOptions(scope, instrumentMfid)
  )

  if (!resource || resource.kind !== "instrument") {
    return (
      <Card className="mx-auto mt-16 max-w-state">
        <CardHeader>
          <CardTitle>Instrument not found</CardTitle>
          <CardDescription>
            This instrument is not available in the current workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <PageLayout>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link search={{ offset: undefined }} to="/instruments" />}
            >
              Instruments
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{resource.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        eyebrow="Instrument"
        title={resource.name}
        description={resource.description ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              <ResourceTypeIcon type="instrument" data-icon="inline-start" />
              {resource.instrument_type ?? "Instrument"}
            </Badge>
            {resource.status ? (
              <InstrumentStatusBadge status={resource.status} />
            ) : null}
          </div>
        }
      />

      <ResourceSectionNavigation label="Instrument sections">
        <Link
          activeOptions={{ exact: true, includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          params={{ instrumentMfid }}
          search={{}}
          to="/instruments/$instrumentMfid"
        >
          Overview
        </Link>
        <Link
          activeOptions={{ includeSearch: false }}
          activeProps={resourceSectionActiveProps}
          className={resourceSectionLinkClassName}
          params={{ instrumentMfid }}
          search={{ cursor: undefined }}
          to="/instruments/$instrumentMfid/datasets"
        >
          Datasets
        </Link>
        {resource.capabilities?.can_change_status === true ||
        resource.capabilities?.can_manage_access === true ||
        resource.capabilities?.can_transfer === true ? (
          <Link
            activeOptions={{ includeSearch: false }}
            activeProps={resourceSectionActiveProps}
            className={resourceSectionLinkClassName}
            params={{ instrumentMfid }}
            search={{}}
            to="/instruments/$instrumentMfid/settings"
          >
            Manage
          </Link>
        ) : null}
      </ResourceSectionNavigation>

      <Outlet />
    </PageLayout>
  )
}
